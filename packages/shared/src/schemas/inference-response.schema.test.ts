import { describe, expect, it } from 'vitest';
import { decode, encode } from './codec.helpers.js';
import { inferenceResponseCodec, type InferenceResponse } from './inference-response.schema.js';

describe('inferenceResponseCodec', () => {
  it('round-trips a chunk variant', () => {
    const original: InferenceResponse = {
      kind: 'chunk',
      jobId: 'job_1',
      delta: 'hello',
    };
    const buf = encode(inferenceResponseCodec, original);
    const decoded = decode(inferenceResponseCodec, buf);
    expect(decoded).toEqual(original);
  });

  it('round-trips a final variant', () => {
    const original: InferenceResponse = {
      kind: 'final',
      jobId: 'job_1',
      finishReason: 'stop',
      promptTokens: 10,
      completionTokens: 42,
      workerPubKey: 'aabbccdd',
    };
    const buf = encode(inferenceResponseCodec, original);
    const decoded = decode(inferenceResponseCodec, buf);
    expect(decoded).toEqual(original);
  });

  it('preserves the discriminant across encodings', () => {
    const a = encode(inferenceResponseCodec, {
      kind: 'chunk',
      jobId: 'j',
      delta: 'x',
    });
    const b = encode(inferenceResponseCodec, {
      kind: 'final',
      jobId: 'j',
      finishReason: 'length',
      promptTokens: 1,
      completionTokens: 2,
      workerPubKey: 'wk',
    });
    expect(decode(inferenceResponseCodec, a).kind).toBe('chunk');
    expect(decode(inferenceResponseCodec, b).kind).toBe('final');
  });
});
