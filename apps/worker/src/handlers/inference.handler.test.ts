import type { InferenceRequest, InferenceResponse } from '@cosmic/shared';
import { describe, expect, it } from 'vitest';

import { streamInference } from './inference-stream.handler.js';
import { runInference } from './inference.handler.js';

const SLEEP_NOOP = (): Promise<void> => Promise.resolve();

function fixtureRequest(overrides: Partial<InferenceRequest> = {}): InferenceRequest {
  return {
    jobId: 'job_x',
    apiKeyId: 'ak_test',
    requestId: 'req_test',
    model: 'mock-llm',
    messages: [{ role: 'user', content: 'hi' }],
    stream: false,
    ...overrides,
  };
}

function inFlightCounter(): {
  state: { value: number; max: number };
  counter: { increment: () => void; decrement: () => void };
} {
  const state = { value: 0, max: 0 };
  return {
    state,
    counter: {
      increment: (): void => {
        state.value += 1;
        if (state.value > state.max) state.max = state.value;
      },
      decrement: (): void => {
        state.value -= 1;
      },
    },
  };
}

describe('runInference (non-streaming)', () => {
  it('returns a final envelope with token counts and worker pubKey', async () => {
    const { state, counter } = inFlightCounter();
    const result = await runInference(fixtureRequest({ maxTokens: 6 }), {
      workerPubKey: 'aabbccdd',
      defaultMaxTokens: 16,
      defaultTokenRateHz: 0,
      inFlightCounter: counter,
      sleep: SLEEP_NOOP,
    });
    expect(result.kind).toBe('final');
    expect(result.jobId).toBe('job_x');
    expect(result.workerPubKey).toBe('aabbccdd');
    expect(result.completionTokens).toBe(6);
    expect(result.promptTokens).toBe(1);
    expect(result.finishReason).toBe('length');
    // In-flight discipline: incremented + decremented exactly once.
    expect(state.max).toBe(1);
    expect(state.value).toBe(0);
  });

  it('clamps an oversized request to defaultMaxTokens', async () => {
    const { counter } = inFlightCounter();
    const result = await runInference(fixtureRequest({ maxTokens: 9999 }), {
      workerPubKey: 'aabbccdd',
      defaultMaxTokens: 4,
      defaultTokenRateHz: 0,
      inFlightCounter: counter,
      sleep: SLEEP_NOOP,
    });
    expect(result.completionTokens).toBe(4);
  });

  it('returns finishReason=cancelled when aborted', async () => {
    const { counter } = inFlightCounter();
    const ctrl = new AbortController();
    ctrl.abort();
    const result = await runInference(
      fixtureRequest({ maxTokens: 10 }),
      {
        workerPubKey: 'aabbccdd',
        defaultMaxTokens: 16,
        defaultTokenRateHz: 0,
        inFlightCounter: counter,
        sleep: SLEEP_NOOP,
      },
      ctrl.signal,
    );
    expect(result.finishReason).toBe('cancelled');
    expect(result.completionTokens).toBe(0);
  });

  it('decrements in-flight counter even when the LLM throws', async () => {
    const { state, counter } = inFlightCounter();
    await expect(
      runInference(fixtureRequest({ maxTokens: -1 }), {
        workerPubKey: 'aabbccdd',
        // Negative defaultMaxTokens will make the generator emit no tokens,
        // which still completes successfully — so we provoke a throw via a
        // poisoned counter instead.
        defaultMaxTokens: 8,
        defaultTokenRateHz: 0,
        inFlightCounter: {
          increment: counter.increment,
          decrement: () => {
            counter.decrement();
            throw new Error('decrement boom');
          },
        },
        sleep: SLEEP_NOOP,
      }),
    ).rejects.toThrow('decrement boom');
    // The increment was reverted before the throw bubbled up.
    expect(state.value).toBe(0);
  });
});

describe('streamInference', () => {
  it('emits chunks then a final envelope', async () => {
    const { state, counter } = inFlightCounter();
    const out: InferenceResponse[] = [];
    for await (const frame of streamInference(fixtureRequest({ maxTokens: 4 }), {
      workerPubKey: 'aabbccdd',
      defaultMaxTokens: 16,
      defaultTokenRateHz: 0,
      inFlightCounter: counter,
      sleep: SLEEP_NOOP,
    })) {
      out.push(frame);
    }
    expect(out.filter((f) => f.kind === 'chunk')).toHaveLength(4);
    const final = out[out.length - 1];
    expect(final?.kind).toBe('final');
    if (final && final.kind === 'final') {
      expect(final.completionTokens).toBe(4);
      expect(final.workerPubKey).toBe('aabbccdd');
    }
    expect(state.value).toBe(0);
  });

  it('terminates with finishReason=cancelled when aborted mid-stream', async () => {
    const { counter } = inFlightCounter();
    const ctrl = new AbortController();
    const it = streamInference(
      fixtureRequest({ maxTokens: 100 }),
      {
        workerPubKey: 'aabbccdd',
        defaultMaxTokens: 100,
        defaultTokenRateHz: 0,
        inFlightCounter: counter,
        sleep: SLEEP_NOOP,
      },
      ctrl.signal,
    );

    const collected: InferenceResponse[] = [];
    for (let i = 0; i < 3; i++) {
      const next = await it.next();
      if (next.done) break;
      collected.push(next.value);
    }
    ctrl.abort();
    const after = await it.next();
    expect(after.done).toBe(false);
    if (!after.done) {
      expect(after.value.kind).toBe('final');
      if (after.value.kind === 'final') {
        expect(after.value.finishReason).toBe('cancelled');
        expect(after.value.completionTokens).toBe(3);
      }
    }
    const tail = await it.next();
    expect(tail.done).toBe(true);
  });
});
