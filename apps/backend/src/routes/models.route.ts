// `GET /v1/models` — OpenAI-compatible model listing.
// Currently returns a hardcoded `mock-llm` entry; Step 6 will replace this
// with data sourced from the worker registry.

import {
  DEFAULT_MODEL_ID,
  ListModelsResponse,
  type ListModelsResponse as ListModelsResponseType,
} from '@cosmic/shared';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const MOCK_MODEL: ListModelsResponseType['data'][number] = {
  id: DEFAULT_MODEL_ID,
  object: 'model',
  owned_by: 'cosmic',
  capabilities: { streaming: true, max_context: 4096 },
};

export const modelsRoute: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    '/models',
    {
      schema: {
        tags: ['Models'],
        summary: 'List available models',
        description: 'Returns the models served by the connected worker pool.',
        response: { 200: ListModelsResponse },
      },
    },
    async (): Promise<ListModelsResponseType> => ({
      object: 'list',
      data: [MOCK_MODEL],
    }),
  );
};
