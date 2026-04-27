import { describe, expect, it } from 'vitest';
import { decode, encode } from './codec.helpers.js';
import { inferenceRequestCodec, type InferenceRequest } from './inference-request.schema.js';

const fixture = (overrides: Partial<InferenceRequest> = {}): InferenceRequest => ({
  jobId: 'job_123',
  apiKeyId: 'ak_a1b2c3d4',
  requestId: 'req_xyz',
  model: 'mock-llm',
  messages: [{ role: 'user', content: 'hello' }],
  stream: false,
  ...overrides,
});

describe('inferenceRequestCodec', () => {
  it('round-trips a minimal request', () => {
    const original = fixture();
    const buf = encode(inferenceRequestCodec, original);
    const decoded = decode(inferenceRequestCodec, buf);
    expect(decoded).toEqual(original);
  });

  it('round-trips multi-message conversations with optional params', () => {
    const original = fixture({
      messages: [
        { role: 'system', content: 'be terse' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'yes' },
        { role: 'user', content: 'thanks' },
      ],
      stream: true,
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 256,
    });
    const buf = encode(inferenceRequestCodec, original);
    const decoded = decode(inferenceRequestCodec, buf);
    expect(decoded).toEqual(original);
  });

  it('handles multi-byte unicode content', () => {
    const original = fixture({
      messages: [{ role: 'user', content: '🚀 café 漢字' }],
    });
    const buf = encode(inferenceRequestCodec, original);
    const decoded = decode(inferenceRequestCodec, buf);
    expect(decoded.messages[0]?.content).toBe('🚀 café 漢字');
  });

  it('omits absent optional fields on decode', () => {
    const original = fixture();
    const buf = encode(inferenceRequestCodec, original);
    const decoded = decode(inferenceRequestCodec, buf);
    expect(decoded.temperature).toBeUndefined();
    expect(decoded.topP).toBeUndefined();
    expect(decoded.maxTokens).toBeUndefined();
  });
});
