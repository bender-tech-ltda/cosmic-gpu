// Synthetic token generator (mock LLM).
//
// The real platform would forward to a model server; for the take-home we
// produce a deterministic stream of pseudo-tokens so the dispatcher,
// streaming SSE bridge, and frontend playground can all be exercised with
// reproducible output.
//
// Determinism is keyed on the inference job id, so repeated retries of the
// same job (e.g. on worker re-dispatch) yield identical tokens. Throughput is
// rate-limited via `tokenRateHz`; cancellation is propagated via an
// `AbortSignal`.

import { createHash } from 'node:crypto';

export interface MockLlmOptions {
  /** Stable identifier; seeds the PRNG so retries are deterministic. */
  jobId: string;
  /** User prompt; used to weight the synthetic vocabulary. */
  prompt: string;
  /** Hard cap on the number of tokens emitted. */
  maxTokens: number;
  /** Approximate token emission rate, in Hz. */
  tokenRateHz: number;
  /** Optional cancellation signal. */
  signal?: AbortSignal;
  /**
   * Internal hook so tests can substitute the inter-token delay function. The
   * default is `await new Promise(r => setTimeout(r, ms))`.
   */
  sleep?: (ms: number) => Promise<void>;
}

export interface MockLlmFinal {
  /** Total prompt tokens (rough whitespace count). */
  promptTokens: number;
  /** Total completion tokens emitted. */
  completionTokens: number;
  /** Why generation stopped. */
  finishReason: 'stop' | 'length' | 'cancelled';
}

const VOCABULARY = [
  'the',
  'quick',
  'brown',
  'fox',
  'jumps',
  'over',
  'a',
  'lazy',
  'cosmic',
  'token',
  'stream',
  'simulation',
  'distributed',
  'gpu',
  'inference',
  'mock',
  'reply',
  'thoughtful',
  'response',
  'about',
  'your',
  'prompt',
  '— ',
  '. ',
  ', ',
  ' ',
];

/** Tiny mulberry32 PRNG; deterministic for a given seed. */
function createPrng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromJobId(jobId: string): number {
  // First 4 bytes of a SHA-256 of the jobId, interpreted as big-endian uint32.
  const digest = createHash('sha256').update(jobId).digest();
  return digest.readUInt32BE(0);
}

function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Async generator yielding token deltas. The generator's `return` value is a
 * `MockLlmFinal` envelope; consumers that want it should wrap the iteration
 * in a `for await` and capture `result.value` from the last `done` step (or
 * use the helper `runMockLlm` below).
 */
export async function* generateMockTokens(
  options: MockLlmOptions,
): AsyncGenerator<string, MockLlmFinal, void> {
  const { jobId, prompt, maxTokens, tokenRateHz, signal } = options;
  const sleep = options.sleep ?? defaultSleep;
  const promptTokens = countPromptTokens(prompt);
  if (maxTokens <= 0) {
    return { promptTokens, completionTokens: 0, finishReason: 'length' };
  }
  const intervalMs = tokenRateHz > 0 ? Math.max(0, 1000 / tokenRateHz) : 0;
  const random = createPrng(seedFromJobId(jobId));

  let completionTokens = 0;
  while (completionTokens < maxTokens) {
    if (signal?.aborted) {
      return { promptTokens, completionTokens, finishReason: 'cancelled' };
    }
    if (intervalMs > 0) await sleep(intervalMs);
    if (signal?.aborted) {
      return { promptTokens, completionTokens, finishReason: 'cancelled' };
    }
    const idx = Math.floor(random() * VOCABULARY.length);
    const token = VOCABULARY[idx] ?? ' ';
    completionTokens += 1;
    yield token;
  }
  return { promptTokens, completionTokens, finishReason: 'length' };
}

/**
 * Run the generator to completion, accumulating the deltas. Used by the
 * non-streaming `inference.run` handler.
 */
export async function runMockLlm(
  options: MockLlmOptions,
): Promise<{ text: string; final: MockLlmFinal }> {
  const it = generateMockTokens(options);
  let text = '';
  for (;;) {
    const next = await it.next();
    if (next.done) {
      return { text, final: next.value };
    }
    text += next.value;
  }
}

/** Whitespace-based prompt token count. Cheap, good enough for the demo. */
export function countPromptTokens(prompt: string): number {
  if (prompt.length === 0) return 0;
  return prompt.trim().split(/\s+/).length;
}
