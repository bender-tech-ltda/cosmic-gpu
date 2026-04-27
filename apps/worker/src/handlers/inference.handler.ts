// `inference.run` handler.
//
// Drives the mock LLM to completion and returns a Compact-Encoded
// `InferenceResponseFinal`. Cancellation is propagated through an
// `AbortSignal` typically derived from the RPC channel's close event.

import type { InferenceRequest, InferenceResponseFinal } from '@cosmic/shared';

import { runMockLlm } from '../simulator/mock-llm.js';

export interface InferenceHandlerDeps {
  /** Hex-encoded worker public key (recorded in the response envelope). */
  workerPubKey: string;
  /** Default mock-LLM tuning. Per-request `temperature` could override later. */
  defaultMaxTokens: number;
  defaultTokenRateHz: number;
  /** Increment / decrement when a job starts / finishes. */
  inFlightCounter: { increment: () => void; decrement: () => void };
  /** Optional sleep injection (used by tests). */
  sleep?: (ms: number) => Promise<void>;
}

export async function runInference(
  request: InferenceRequest,
  deps: InferenceHandlerDeps,
  signal?: AbortSignal,
): Promise<InferenceResponseFinal> {
  deps.inFlightCounter.increment();
  try {
    const prompt = request.messages.map((m) => m.content).join('\n');
    const cap =
      typeof request.maxTokens === 'number' && request.maxTokens > 0
        ? Math.min(request.maxTokens, deps.defaultMaxTokens)
        : deps.defaultMaxTokens;

    const { text, final } = await runMockLlm({
      jobId: request.jobId,
      prompt,
      maxTokens: cap,
      tokenRateHz: deps.defaultTokenRateHz,
      signal,
      sleep: deps.sleep,
    });

    return {
      kind: 'final',
      jobId: request.jobId,
      finishReason: final.finishReason,
      promptTokens: final.promptTokens,
      completionTokens: final.completionTokens,
      workerPubKey: deps.workerPubKey,
      text,
    };
  } finally {
    deps.inFlightCounter.decrement();
  }
}
