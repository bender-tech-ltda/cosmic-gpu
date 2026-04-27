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
): Promise<{ app: FastifyInstance; plaintext: string; dispatch: StubDispatcher['dispatch'] }> {
  const app = await buildApp({ logger: false });
  // app.p2p isn't decorated by the test build (NODE_ENV=test skips p2pPlugin),
  // so we attach a minimal stub directly.
  const dispatcher = { dispatch } as unknown as InferenceDispatcher;
  // @ts-expect-error \u2014 decorate would refuse a duplicate; we set directly for tests.
  app.p2p = {
    dispatcher,
    registry: { size: () => 0 },
    swarm: undefined,
    rpcClient: undefined,
    close: async () => {},
  };
  await app.ready();
  const created = await app.apiKeys.create({ name: 'chat-fixture' });
  return { app, plaintext: created.plaintext, dispatch };
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

  it('rejects stream:true with 400 ValidationFailed (Step 7 lifts this)', async () => {
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
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: ERROR_CODE.validationFailed });
    expect(dispatch).not.toHaveBeenCalled();
  });

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
