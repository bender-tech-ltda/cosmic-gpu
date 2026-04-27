import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import { ChatCompletionRequest } from './chat-completion.dto.js';

describe('ChatCompletionRequest schema', () => {
  it('accepts a minimal valid request', () => {
    const valid = {
      model: 'mock-llm',
      messages: [{ role: 'user', content: 'hi' }],
    };
    expect(Value.Check(ChatCompletionRequest, valid)).toBe(true);
  });

  it('accepts a full streaming request', () => {
    const valid = {
      model: 'mock-llm',
      messages: [
        { role: 'system', content: 'be terse' },
        { role: 'user', content: 'hi' },
      ],
      stream: true,
      temperature: 0.5,
      top_p: 0.9,
      max_tokens: 256,
    };
    expect(Value.Check(ChatCompletionRequest, valid)).toBe(true);
  });

  it('rejects an empty messages array', () => {
    const invalid = { model: 'mock-llm', messages: [] };
    expect(Value.Check(ChatCompletionRequest, invalid)).toBe(false);
  });

  it('rejects out-of-range temperature', () => {
    const invalid = {
      model: 'mock-llm',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 5,
    };
    expect(Value.Check(ChatCompletionRequest, invalid)).toBe(false);
  });

  it('rejects unknown role', () => {
    const invalid = {
      model: 'mock-llm',
      messages: [{ role: 'admin', content: 'hi' }],
    };
    expect(Value.Check(ChatCompletionRequest, invalid)).toBe(false);
  });

  it('rejects empty content string', () => {
    const invalid = {
      model: 'mock-llm',
      messages: [{ role: 'user', content: '' }],
    };
    expect(Value.Check(ChatCompletionRequest, invalid)).toBe(false);
  });
});
