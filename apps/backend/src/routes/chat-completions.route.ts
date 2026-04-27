// `POST /v1/chat/completions` — OpenAI-compatible inference endpoint.
//
// Step 6 lands the **non-streaming** branch. `body.stream === true` returns
// a 400 ValidationFailed envelope until the SSE bridge ships in Step 7.
// Streaming-aware reviewers can find the deferral note in the README's
// endpoint table and `docs/architecture.md` §2.3.

import {
  ChatCompletionRequest,
  ERROR_CODE,
  SSE_CONTENT_TYPE,
  SSE_DONE_MARKER,
  type ApiErrorBody,
  type ChatCompletionChunk,
  type InferenceResponseChunk,
  type InferenceResponseFinal,
} from '@cosmic/shared';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { once } from 'node:events';

import { DomainError, isDomainError } from '../errors/domain-error.js';

/** ISO timestamp rounded down to the start of the current minute. */
function currentWindowStart(now: number = Date.now()): string {
  const d = new Date(now);
  d.setUTCSeconds(0, 0);
  return d.toISOString();
}

export const chatCompletionsRoute: FastifyPluginAsyncTypebox = async (app) => {
  app.post(
    '/chat/completions',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Inference'],
        summary: 'Create a chat completion (OpenAI-compatible)',
        description:
          'Dispatches an inference request to an available worker via Hyperswarm RPC. With `stream: false` (default) returns an OpenAI-shaped `ChatCompletion`; with `stream: true` returns `text/event-stream` with `data: {ChatCompletionChunk}\n\n` events terminated by `data: [DONE]\n\n`.',
        body: ChatCompletionRequest,
        // Response schema is intentionally omitted: when `stream: true` the
        // handler hijacks the reply and writes SSE directly, which would
        // conflict with the TypeBox response validator. Non-streaming
        // responses still match the `ChatCompletion` shape — see
        // `apps/backend/src/p2p/dispatcher.ts` for the mapping.
      },
    },
    async (request, reply) => {
      const apiKey = request.apiKey;
      if (!apiKey) {
        // Defensive: the auth preHandler should always populate this. If it
        // didn't, fail closed rather than dispatch with an empty key id.
        throw new DomainError({
          statusCode: 401,
          code: ERROR_CODE.apiKeyMissing,
          message: 'Authenticated key context is missing.',
        });
      }

      if (request.body.stream === true) {
        return streamCompletion(app, request, reply, apiKey.id, request.body);
      }

      const completion = await app.p2p.dispatcher.dispatch(request.body, apiKey.id);

      // Best-effort usage counters; failures here don't break the response.
      try {
        await app.state.usage.incrementCounter(apiKey.id, currentWindowStart(), {
          requests: 1,
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
        });
      } catch (err) {
        request.log.warn({ err }, 'usage.counter.increment failed');
      }

      return completion;
    },
  );
};

/**
 * Drive a streaming dispatch and emit OpenAI-shaped SSE chunks. Cancellation
 * propagates through an `AbortController` linked to the client connection.
 */
async function streamCompletion(
  app: Parameters<FastifyPluginAsyncTypebox>[0],
  request: FastifyRequest,
  reply: FastifyReply,
  apiKeyId: string,
  body: ChatCompletionRequest,
): Promise<FastifyReply> {
  reply.raw.statusCode = 200;
  reply.raw.setHeader('Content-Type', SSE_CONTENT_TYPE);
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.hijack();
  if (typeof reply.raw.flushHeaders === 'function') reply.raw.flushHeaders();

  const ctrl = new AbortController();
  const onClientClose = (): void => ctrl.abort();
  request.raw.on('close', onClientClose);

  let final: InferenceResponseFinal | null = null;
  const created = Math.floor(Date.now() / 1000);

  try {
    let jobId: string | null = null;
    for await (const frame of app.p2p.dispatcher.dispatchStream(body, apiKeyId, ctrl.signal)) {
      if (jobId === null) jobId = frame.jobId;
      if (frame.kind === 'chunk') {
        await writeSseEvent(reply.raw, mapChunk(frame, body, created));
      } else {
        final = frame;
        await writeSseEvent(reply.raw, mapFinalChunk(frame, body, created));
      }
    }
  } catch (err) {
    const body = errorEnvelope(err, request.id);
    await writeSseEvent(reply.raw, { error: body }).catch(() => {
      /* socket already closed */
    });
  } finally {
    request.raw.off('close', onClientClose);
  }

  // Best-effort usage counters; only when we got a final envelope.
  if (final) {
    try {
      await app.state.usage.incrementCounter(apiKeyId, currentWindowStart(), {
        requests: 1,
        promptTokens: final.promptTokens,
        completionTokens: final.completionTokens,
      });
    } catch (err) {
      request.log.warn({ err }, 'usage.counter.increment failed');
    }
  }

  await writeSseRaw(reply.raw, `data: ${SSE_DONE_MARKER}\n\n`).catch(() => {
    /* socket already closed */
  });
  if (!reply.raw.writableEnded) reply.raw.end();
  return reply;
}

function mapChunk(
  frame: InferenceResponseChunk,
  request: ChatCompletionRequest,
  created: number,
): ChatCompletionChunk {
  return {
    id: frame.jobId,
    object: 'chat.completion.chunk',
    created,
    model: request.model,
    choices: [
      {
        index: 0,
        delta: { role: 'assistant', content: frame.delta },
        finish_reason: null,
      },
    ],
  };
}

function mapFinalChunk(
  frame: InferenceResponseFinal,
  request: ChatCompletionRequest,
  created: number,
): ChatCompletionChunk {
  return {
    id: frame.jobId,
    object: 'chat.completion.chunk',
    created,
    model: request.model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: frame.finishReason,
      },
    ],
  };
}

function errorEnvelope(err: unknown, requestId: string): ApiErrorBody {
  if (isDomainError(err)) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      requestId,
      ...(err.details !== undefined ? { details: err.details } : {}),
    };
  }
  return {
    statusCode: 500,
    code: ERROR_CODE.internalError,
    message: 'An unexpected error occurred during streaming.',
    requestId,
  };
}

async function writeSseEvent(
  raw: NodeJS.WritableStream & { write: (chunk: string) => boolean },
  payload: unknown,
): Promise<void> {
  await writeSseRaw(raw, `data: ${JSON.stringify(payload)}\n\n`);
}

async function writeSseRaw(
  raw: NodeJS.WritableStream & { write: (chunk: string) => boolean },
  chunk: string,
): Promise<void> {
  const ok = raw.write(chunk);
  if (!ok) {
    await once(raw as unknown as NodeJS.EventEmitter, 'drain');
  }
}
