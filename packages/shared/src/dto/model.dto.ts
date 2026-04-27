import { Type, type Static } from '@sinclair/typebox';

export const ModelInfo = Type.Object({
  id: Type.String({ examples: ['mock-llm'] }),
  object: Type.Literal('model'),
  owned_by: Type.String({ examples: ['cosmic'] }),
  capabilities: Type.Object({
    streaming: Type.Boolean(),
    max_context: Type.Integer({ minimum: 1 }),
  }),
});
export type ModelInfo = Static<typeof ModelInfo>;

export const ListModelsResponse = Type.Object({
  object: Type.Literal('list'),
  data: Type.Array(ModelInfo),
});
export type ListModelsResponse = Static<typeof ListModelsResponse>;
