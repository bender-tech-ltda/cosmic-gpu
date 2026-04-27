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

  it('round-trips multi-byte UTF-8 in delta', () => {
    const original: InferenceResponse = {
      kind: 'chunk',
      jobId: 'job_1',
      delta: '🚀 café 漢字 🌌',
    };
    const buf = encode(inferenceResponseCodec, original);
    const decoded = decode(inferenceResponseCodec, buf);
    expect(decoded).toEqual(original);
  });

  it('round-trips an empty delta string', () => {
    const original: InferenceResponse = { kind: 'chunk', jobId: 'j', delta: '' };
    const buf = encode(inferenceResponseCodec, original);
    expect(decode(inferenceResponseCodec, buf)).toEqual(original);
  });

  it.each([['stop'], ['length'], ['cancelled']] as const)(
    'round-trips finishReason=%s',
    (finishReason) => {
      const original: InferenceResponse = {
        kind: 'final',
        jobId: 'j',
        finishReason,
        promptTokens: 0,
        completionTokens: 0,
        workerPubKey: 'wk',
      };
      const buf = encode(inferenceResponseCodec, original);
      expect(decode(inferenceResponseCodec, buf)).toEqual(original);
    },
  );

  it('round-trips zero token counts', () => {
    const original: InferenceResponse = {
      kind: 'final',
      jobId: 'j',
      finishReason: 'stop',
      promptTokens: 0,
      completionTokens: 0,
      workerPubKey: 'wk',
    };
    const buf = encode(inferenceResponseCodec, original);
    expect(decode(inferenceResponseCodec, buf)).toEqual(original);
  });

  it('round-trips a final variant with completion text', () => {
    const original: InferenceResponse = {
      kind: 'final',
      jobId: 'j',
      finishReason: 'stop',
      promptTokens: 3,
      completionTokens: 5,
      workerPubKey: 'wk',
      text: 'the quick brown fox \ud83d\ude80',
    };
    const buf = encode(inferenceResponseCodec, original);
    expect(decode(inferenceResponseCodec, buf)).toEqual(original);
  });

  it('decodes a final variant without text as undefined', () => {
    const original: InferenceResponse = {
      kind: 'final',
      jobId: 'j',
      finishReason: 'length',
      promptTokens: 1,
      completionTokens: 2,
      workerPubKey: 'wk',
    };
    const buf = encode(inferenceResponseCodec, original);
    const decoded = decode(inferenceResponseCodec, buf) as Extract<
      InferenceResponse,
      { kind: 'final' }
    >;
    expect(decoded.text).toBeUndefined();
  });
});
