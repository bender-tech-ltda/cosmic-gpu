// `POST /v1/chat/completions` — OpenAI-compatible inference endpoint.
//
// Step 6 lands the **non-streaming** branch. `body.stream === true` returns
// a 400 ValidationFailed envelope until the SSE bridge ships in Step 7.
// Streaming-aware reviewers can find the deferral note in the README's
// endpoint table and `docs/architecture.md` §2.3.

import {
  ChatCompletion,
  ChatCompletionRequest,
  ERROR_CODE,
  type ChatCompletion as ChatCompletionType,
} from '@cosmic/shared';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { DomainError } from '../errors/domain-error.js';

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
        summary: 'Create a chat completion (OpenAI-compatible, non-streaming)',
        description:
          'Dispatches an inference request to an available worker via Hyperswarm RPC and returns an OpenAI-shaped ChatCompletion. Streaming (`stream: true`) is added in Step 7.',
        body: ChatCompletionRequest,
        response: { 200: ChatCompletion },
      },
    },
    async (request): Promise<ChatCompletionType> => {
      if (request.body.stream === true) {
        throw new DomainError({
          statusCode: 400,
          code: ERROR_CODE.validationFailed,
          message:
            'Streaming responses are not yet supported. Set "stream": false (or omit it) for non-streaming inference. Streaming SSE lands in Step 7.',
        });
      }

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
