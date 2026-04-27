// OpenAI-compatible chat completion DTOs (HTTP layer).
// The wire format mirrors OpenAI's `/v1/chat/completions` shape so existing
// SDKs work unchanged against this service.

import { Type, type Static } from '@sinclair/typebox';

export const Role = Type.Union([
  Type.Literal('system'),
  Type.Literal('user'),
  Type.Literal('assistant'),
]);
export type Role = Static<typeof Role>;

export const ChatMessage = Type.Object({
  role: Role,
  content: Type.String({ minLength: 1 }),
});
export type ChatMessage = Static<typeof ChatMessage>;

export const ChatCompletionRequest = Type.Object({
  model: Type.String({
    description: 'Model id; e.g. "mock-llm" for the simulator.',
    examples: ['mock-llm'],
  }),
  messages: Type.Array(ChatMessage, { minItems: 1 }),
  stream: Type.Optional(Type.Boolean({ default: false })),
  temperature: Type.Optional(Type.Number({ minimum: 0, maximum: 2 })),
  top_p: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  max_tokens: Type.Optional(Type.Integer({ minimum: 1, maximum: 4096 })),
});
export type ChatCompletionRequest = Static<typeof ChatCompletionRequest>;

export const Usage = Type.Object({
  prompt_tokens: Type.Integer({ minimum: 0 }),
  completion_tokens: Type.Integer({ minimum: 0 }),
  total_tokens: Type.Integer({ minimum: 0 }),
});
export type Usage = Static<typeof Usage>;

const FinishReason = Type.Union([
  Type.Literal('stop'),
  Type.Literal('length'),
  Type.Literal('cancelled'),
  Type.Null(),
]);

export const ChatCompletionChoice = Type.Object({
  index: Type.Integer({ minimum: 0 }),
  message: ChatMessage,
  finish_reason: FinishReason,
});
export type ChatCompletionChoice = Static<typeof ChatCompletionChoice>;

export const ChatCompletion = Type.Object({
  id: Type.String(),
  object: Type.Literal('chat.completion'),
  created: Type.Integer(),
  model: Type.String(),
  choices: Type.Array(ChatCompletionChoice, { minItems: 1 }),
  usage: Usage,
});
export type ChatCompletion = Static<typeof ChatCompletion>;

// Streaming chunk (single SSE event payload).
export const ChatCompletionChunkChoice = Type.Object({
  index: Type.Integer({ minimum: 0 }),
  delta: Type.Object({
    role: Type.Optional(Role),
    content: Type.Optional(Type.String()),
  }),
  finish_reason: FinishReason,
});

export const ChatCompletionChunk = Type.Object({
  id: Type.String(),
  object: Type.Literal('chat.completion.chunk'),
  created: Type.Integer(),
  model: Type.String(),
  choices: Type.Array(ChatCompletionChunkChoice, { minItems: 1 }),
});
export type ChatCompletionChunk = Static<typeof ChatCompletionChunk>;
