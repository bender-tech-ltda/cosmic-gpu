import { ERROR_CODE, type ChatCompletion } from '@cosmic/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../app.js';
import { DomainError } from '../errors/domain-error.js';
import type { InferenceDispatcher } from '../p2p/dispatcher.js';

function buildCompletion(overrides: Partial<ChatCompletion> = {}): ChatCompletion {
  return {
    id: 'job_test',
    object: 'chat.completion',
    created: 1_700_000_000,
    model: 'mock-llm',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'hello' },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    ...overrides,
  };
}

interface StubDispatcher {
  dispatch: ReturnType<typeof vi.fn>;
}

async function buildAppWithStubDispatcher(
  dispatch: StubDispatcher['dispatch'] = vi.fn(),
  dispatchStream: ReturnType<typeof vi.fn> = vi.fn(),
): Promise<{
  app: FastifyInstance;
  plaintext: string;
  dispatch: StubDispatcher['dispatch'];
  dispatchStream: ReturnType<typeof vi.fn>;
}> {
  const app = await buildApp({ logger: false });
  // app.p2p isn't decorated by the test build (NODE_ENV=test skips p2pPlugin),
  // so we attach a minimal stub directly.
  const dispatcher = { dispatch, dispatchStream } as unknown as InferenceDispatcher;
  // @ts-expect-error — decorate would refuse a duplicate; we set directly for tests.
  app.p2p = {
    dispatcher,
    registry: { size: () => 0 },
    swarm: undefined,
    rpcClient: undefined,
    streamTransport: undefined,
    close: async () => {},
  };
  await app.ready();
  const created = await app.apiKeys.create({ name: 'chat-fixture' });
  return { app, plaintext: created.plaintext, dispatch, dispatchStream };
}

describe('POST /v1/chat/completions', () => {
  let app: FastifyInstance;
  let plaintext: string;
  let dispatch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    ({ app, plaintext, dispatch } = await buildAppWithStubDispatcher(
      vi.fn(async () => buildCompletion()),
    ));
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 without an Authorization header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      payload: { model: 'mock-llm', messages: [{ role: 'user', content: 'hi' }] },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: ERROR_CODE.apiKeyMissing });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('returns 401 with an unknown bearer token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { authorization: 'Bearer sk-not-a-real-key' },
      payload: { model: 'mock-llm', messages: [{ role: 'user', content: 'hi' }] },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: ERROR_CODE.apiKeyInvalid });
  });

  // Step 7 turned this into a real streaming branch — see the SSE tests below.

  it('returns 503 NoWorkersAvailable from the dispatcher', async () => {
    const noWorkers = vi.fn(async () => {
      throw new DomainError({
        statusCode: 503,
        code: ERROR_CODE.noWorkersAvailable,
        message: 'No workers',
      });
    });
    await app.close();
    ({ app, plaintext, dispatch } = await buildAppWithStubDispatcher(noWorkers));

    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { authorization: `Bearer ${plaintext}` },
      payload: { model: 'mock-llm', messages: [{ role: 'user', content: 'hi' }] },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: ERROR_CODE.noWorkersAvailable });
  });

  it('returns 503 WorkerTimeout from the dispatcher', async () => {
    const timeout = vi.fn(async () => {
      throw new DomainError({
        statusCode: 503,
        code: ERROR_CODE.workerTimeout,
        message: 'Worker timed out',
      });
    });
    await app.close();
    ({ app, plaintext, dispatch } = await buildAppWithStubDispatcher(timeout));

    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { authorization: `Bearer ${plaintext}` },
      payload: { model: 'mock-llm', messages: [{ role: 'user', content: 'hi' }] },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: ERROR_CODE.workerTimeout });
  });

  it('streams SSE chunks terminated by [DONE] and updates usage counters', async () => {
    const dispatchStream = vi.fn(async function* () {
      yield { kind: 'chunk', jobId: 'job_stream', delta: 'hello ' };
      yield { kind: 'chunk', jobId: 'job_stream', delta: 'world' };
      yield {
        kind: 'final',
        jobId: 'job_stream',
        finishReason: 'stop',
        promptTokens: 1,
        completionTokens: 2,
        workerPubKey: 'aabbccdd',
        text: 'hello world',
      };
    });
    await app.close();
    const built = await buildAppWithStubDispatcher(
      vi.fn(async () => buildCompletion()),
      dispatchStream,
    );
    app = built.app;
    plaintext = built.plaintext;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { authorization: `Bearer ${plaintext}` },
      payload: {
        model: 'mock-llm',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    const body = res.payload;
    expect(body).toContain('data: ');
    expect(body).toContain('hello ');
    expect(body).toContain('world');
    expect(body).toContain('"finish_reason":"stop"');
    expect(body.endsWith('data: [DONE]\n\n')).toBe(true);
    expect(dispatchStream).toHaveBeenCalledTimes(1);

    const apiKeyId = (await firstApiKeyId(app)) ?? 'missing';
    const records: Array<{ requests: number; promptTokens: number; completionTokens: number }> = [];
    for await (const r of app.state.usage.listForKey(apiKeyId)) records.push(r);
    expect(records[0]).toMatchObject({
      requests: 1,
      promptTokens: 1,
      completionTokens: 2,
    });
  });

  it('emits an SSE error event when the dispatcher throws on stream', async () => {
    const dispatchStream = vi.fn(async function* (): AsyncGenerator<unknown, void, void> {
      // Throw before producing anything; the empty `yield` keeps ESLint's
      // require-yield rule happy without changing semantics (the throw runs first).
      if (false as boolean) yield undefined;
      throw new DomainError({
        statusCode: 503,
        code: ERROR_CODE.noWorkersAvailable,
        message: 'No workers',
      });
    });
    await app.close();
    const built = await buildAppWithStubDispatcher(
      vi.fn(async () => buildCompletion()),
      dispatchStream,
    );
    app = built.app;
    plaintext = built.plaintext;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { authorization: `Bearer ${plaintext}` },
      payload: {
        model: 'mock-llm',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.payload).toContain('"code":"NoWorkersAvailable"');
    expect(res.payload.endsWith('data: [DONE]\n\n')).toBe(true);
  });

  it('returns the ChatCompletion shape and increments usage counters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { authorization: `Bearer ${plaintext}` },
      payload: {
        model: 'mock-llm',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 8,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as ChatCompletion;
    expect(body.object).toBe('chat.completion');
    expect(body.choices[0]?.message.content).toBe('hello');
    expect(body.usage.total_tokens).toBe(3);
    expect(dispatch).toHaveBeenCalledTimes(1);

    // Usage counters incremented for the bearer's apiKey.
    const apiKeyId = (await firstApiKeyId(app)) ?? 'missing';
    const records: Array<{ requests: number; promptTokens: number; completionTokens: number }> = [];
    for await (const r of app.state.usage.listForKey(apiKeyId)) records.push(r);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      requests: 1,
      promptTokens: 1,
      completionTokens: 2,
    });
  });
});

async function firstApiKeyId(app: FastifyInstance): Promise<string | null> {
  for await (const k of app.state.apiKeys.list()) return k.id;
  return null;
}
