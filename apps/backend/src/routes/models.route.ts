// `GET /v1/models` — OpenAI-compatible model listing.
// Sources the live model ids from the worker registry (when present) and
// falls back to the hardcoded `mock-llm` entry when no workers are connected
// yet (or when the P2P plugin is disabled in tests).

import {
  DEFAULT_MODEL_ID,
  ListModelsResponse,
  type ListModelsResponse as ListModelsResponseType,
} from '@cosmic/shared';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const FALLBACK_MODEL: ListModelsResponseType['data'][number] = {
  id: DEFAULT_MODEL_ID,
  object: 'model',
  owned_by: 'cosmic',
  capabilities: { streaming: true, max_context: 4096 },
};

export const modelsRoute: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    '/models',
    {
      // OpenAI compatibility convention: model listing is not rate-limited.
      config: { rateLimit: false },
      schema: {
        tags: ['Models'],
        summary: 'List available models',
        description: 'Returns the models served by the connected worker pool.',
        response: { 200: ListModelsResponse },
      },
    },
    async (): Promise<ListModelsResponseType> => {
      const seen = new Set<string>();
      const data: ListModelsResponseType['data'] = [];
      for await (const w of app.state.workers.list()) {
        if (seen.has(w.modelId)) continue;
        seen.add(w.modelId);
        data.push({
          id: w.modelId,
          object: 'model',
          owned_by: 'cosmic',
          capabilities: { streaming: true, max_context: 4096 },
        });
      }
      return { object: 'list', data: data.length > 0 ? data : [FALLBACK_MODEL] };
    },
  );
};
