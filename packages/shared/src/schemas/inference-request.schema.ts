// Compact Encoding schema for backend → worker inference RPC requests.
// SCHEMA EVOLUTION POLICY: APPEND-ONLY.

import {
  array,
  cbool,
  cstring,
  cuint,
  defineObject,
  optional,
  type Codec,
} from './codec.helpers.js';

export type InferenceRole = 'system' | 'user' | 'assistant';

export interface InferenceRequestMessage {
  role: InferenceRole;
  content: string;
}

export interface InferenceRequest {
  jobId: string;
  apiKeyId: string;
  requestId: string;
  model: string;
  messages: InferenceRequestMessage[];
  stream: boolean;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

const messageCodec: Codec<InferenceRequestMessage> = {
  preencode(state, value) {
    cstring.preencode(state, value.role);
    cstring.preencode(state, value.content);
  },
  encode(state, value) {
    cstring.encode(state, value.role);
    cstring.encode(state, value.content);
  },
  decode(state) {
    const role = cstring.decode(state) as InferenceRole;
    const content = cstring.decode(state);
    return { role, content };
  },
};

// Floats are encoded as fixed-point integers (×1000) to keep the wire integer-only.
const fixedPoint1000: Codec<number> = {
  preencode(state, value) {
    cuint.preencode(state, Math.round(value * 1000));
  },
  encode(state, value) {
    cuint.encode(state, Math.round(value * 1000));
  },
  decode(state) {
    return cuint.decode(state) / 1000;
  },
};

export const inferenceRequestCodec: Codec<InferenceRequest> = defineObject({
  jobId: cstring,
  apiKeyId: cstring,
  requestId: cstring,
  model: cstring,
  messages: array(messageCodec),
  stream: cbool,
  temperature: optional(fixedPoint1000),
  topP: optional(fixedPoint1000),
  maxTokens: optional(cuint),
});
