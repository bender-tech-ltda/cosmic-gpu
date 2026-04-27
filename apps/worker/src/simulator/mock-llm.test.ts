import { describe, expect, it } from 'vitest';

import { countPromptTokens, generateMockTokens, runMockLlm } from './mock-llm.js';

const SLEEP_NOOP = (): Promise<void> => Promise.resolve();

describe('mock-llm', () => {
  it('runMockLlm returns deterministic text for a given jobId', async () => {
    const a = await runMockLlm({
      jobId: 'job_a',
      prompt: 'hello world',
      maxTokens: 8,
      tokenRateHz: 0,
      sleep: SLEEP_NOOP,
    });
    const b = await runMockLlm({
      jobId: 'job_a',
      prompt: 'hello world',
      maxTokens: 8,
      tokenRateHz: 0,
      sleep: SLEEP_NOOP,
    });
    expect(a.text).toBe(b.text);
    expect(a.final.completionTokens).toBe(8);
    expect(a.final.finishReason).toBe('length');
  });

  it('different jobIds produce different streams', async () => {
    const a = await runMockLlm({
      jobId: 'job_a',
      prompt: 'hello',
      maxTokens: 16,
      tokenRateHz: 0,
      sleep: SLEEP_NOOP,
    });
    const b = await runMockLlm({
      jobId: 'job_b',
      prompt: 'hello',
      maxTokens: 16,
      tokenRateHz: 0,
      sleep: SLEEP_NOOP,
    });
    expect(a.text).not.toBe(b.text);
  });

  it('honours an AbortSignal between tokens', async () => {
    const ctrl = new AbortController();
    const it = generateMockTokens({
      jobId: 'job_cancel',
      prompt: 'hi',
      maxTokens: 100,
      tokenRateHz: 0,
      signal: ctrl.signal,
      sleep: SLEEP_NOOP,
    });

    const collected: string[] = [];
    for (let i = 0; i < 3; i++) {
      const next = await it.next();
      if (next.done) break;
      collected.push(next.value);
    }
    ctrl.abort();
    const tail = await it.next();
    expect(tail.done).toBe(true);
    if (tail.done) {
      expect(tail.value.finishReason).toBe('cancelled');
      expect(tail.value.completionTokens).toBe(3);
    }
    expect(collected).toHaveLength(3);
  });

  it('returns finishReason=length when maxTokens is reached', async () => {
    const { final } = await runMockLlm({
      jobId: 'job_len',
      prompt: 'hi',
      maxTokens: 5,
      tokenRateHz: 0,
      sleep: SLEEP_NOOP,
    });
    expect(final.finishReason).toBe('length');
    expect(final.completionTokens).toBe(5);
  });

  it('returns zero completions when maxTokens is 0', async () => {
    const { text, final } = await runMockLlm({
      jobId: 'job_zero',
      prompt: 'hi',
      maxTokens: 0,
      tokenRateHz: 0,
      sleep: SLEEP_NOOP,
    });
    expect(text).toBe('');
    expect(final.completionTokens).toBe(0);
    expect(final.finishReason).toBe('length');
  });

  it('records prompt tokens via whitespace split', () => {
    expect(countPromptTokens('')).toBe(0);
    expect(countPromptTokens('hello')).toBe(1);
    expect(countPromptTokens('hello   world')).toBe(2);
    expect(countPromptTokens('  the quick brown fox\nbar ')).toBe(5);
  });

  it('uses the injected sleep function (rate timing is mockable)', async () => {
    const calls: number[] = [];
    await runMockLlm({
      jobId: 'job_rate',
      prompt: 'hi',
      maxTokens: 4,
      tokenRateHz: 100,
      sleep: (ms) => {
        calls.push(ms);
        return Promise.resolve();
      },
    });
    // 1 / 100 Hz = 10 ms per token.
    expect(calls).toEqual([10, 10, 10, 10]);
  });
});
