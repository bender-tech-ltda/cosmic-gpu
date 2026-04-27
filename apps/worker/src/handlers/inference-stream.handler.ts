// `inference.stream` handler (channel-side).
//
// Emits Compact-Encoded `InferenceResponseChunk` frames followed by a single
// `InferenceResponseFinal`. The runtime layer (`stream-channel.ts`) wraps
// these into Protomux channel messages; this handler stays transport-agnostic
// so we can unit-test it without a live Hyperswarm session.

import type { InferenceRequest, InferenceResponse, InferenceResponseFinal } from '@cosmic/shared';

import { generateMockTokens } from '../simulator/mock-llm.js';
import type { InferenceHandlerDeps } from './inference.handler.js';

export async function* streamInference(
  request: InferenceRequest,
  deps: InferenceHandlerDeps,
  signal?: AbortSignal,
): AsyncGenerator<InferenceResponse, void, void> {
  deps.inFlightCounter.increment();
  try {
    const prompt = request.messages.map((m) => m.content).join('\n');
    const cap =
      typeof request.maxTokens === 'number' && request.maxTokens > 0
        ? Math.min(request.maxTokens, deps.defaultMaxTokens)
        : deps.defaultMaxTokens;

    const it = generateMockTokens({
      jobId: request.jobId,
      prompt,
      maxTokens: cap,
      tokenRateHz: deps.defaultTokenRateHz,
      signal,
      sleep: deps.sleep,
    });

    let last: InferenceResponseFinal | null = null;
    for (;;) {
      const next = await it.next();
      if (next.done) {
        last = {
          kind: 'final',
          jobId: request.jobId,
          finishReason: next.value.finishReason,
          promptTokens: next.value.promptTokens,
          completionTokens: next.value.completionTokens,
          workerPubKey: deps.workerPubKey,
        };
        break;
      }
      yield {
        kind: 'chunk',
        jobId: request.jobId,
        delta: next.value,
      };
    }
    if (last !== null) yield last;
  } finally {
    deps.inFlightCounter.decrement();
  }
}
