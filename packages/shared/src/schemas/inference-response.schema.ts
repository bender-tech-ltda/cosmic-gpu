// Compact Encoding schema for worker → backend inference RPC responses.
// Tagged union: `chunk` (token delta) | `final` (terminal envelope).
// SCHEMA EVOLUTION POLICY: APPEND-ONLY.

import { cstring, cuint, defineObject, taggedUnion, type Codec } from './codec.helpers.js';

export type InferenceFinishReason = 'stop' | 'length' | 'cancelled';

export interface InferenceResponseChunk {
  kind: 'chunk';
  jobId: string;
  delta: string;
}

export interface InferenceResponseFinal {
  kind: 'final';
  jobId: string;
  finishReason: InferenceFinishReason;
  promptTokens: number;
  completionTokens: number;
  workerPubKey: string;
}

export type InferenceResponse = InferenceResponseChunk | InferenceResponseFinal;

const chunkInner: Codec<Omit<InferenceResponseChunk, 'kind'>> = defineObject({
  jobId: cstring,
  delta: cstring,
});

const finalInner: Codec<Omit<InferenceResponseFinal, 'kind'>> = defineObject({
  jobId: cstring,
  finishReason: cstring as Codec<InferenceFinishReason>,
  promptTokens: cuint,
  completionTokens: cuint,
  workerPubKey: cstring,
});

export const inferenceResponseCodec: Codec<InferenceResponse> = taggedUnion<InferenceResponse>({
  chunk: chunkInner,
  final: finalInner,
});
