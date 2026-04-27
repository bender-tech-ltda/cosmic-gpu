// Inference dispatcher.
//
// Selects a worker via least-in-flight (with random tiebreak), tracks the job
// lifecycle in `JobsState`, calls the worker over `@hyperswarm/rpc`, and maps
// the wire `InferenceResponseFinal` into the OpenAI-shaped `ChatCompletion`.
//
// On RPC failure, re-dispatches **once** to a different worker. Second
// failure → `DomainError(503, workerTimeout)`. Empty registry → 503
// `noWorkersAvailable` envelope.

import {
  ERROR_CODE,
  RPC_METHOD,
  inferenceRequestCodec,
  inferenceResponseCodec,
  type ChatCompletion,
  type ChatCompletionRequest,
  type InferenceRequest,
  type InferenceResponse,
  type InferenceResponseFinal,
} from '@cosmic/shared';
import { randomBytes } from 'node:crypto';

import { DomainError } from '../errors/domain-error.js';
import { AUDIT_EVENT, logEvent, type AuditLogger } from '../observability/audit.js';
import type { JobsState, JobRecord } from '../state/jobs.state.js';
import type { WorkerRecord, WorkersState } from '../state/workers.state.js';
import type { RpcClient } from './rpc-client.js';
import type { StreamTransport } from './stream-transport.js';

export interface DispatcherDeps {
  rpcClient: RpcClient;
  /**
   * Streaming transport. Optional so non-streaming-only environments and
   * tests can omit it; the streaming path throws if it isn't provided.
   */
  streamTransport?: StreamTransport;
  workersState: WorkersState;
  jobsState: JobsState;
  log: AuditLogger;
  /** Injectable RNG for deterministic tiebreak in tests. */
  random?: () => number;
  /** Injectable clock for timestamps in tests. */
  now?: () => number;
}

export class InferenceDispatcher {
  /**
   * Local in-flight map: counts the dispatches that this backend has open
   * with each worker, regardless of what the worker last reported in
   * `worker.health`. Combined with the worker's reported `inFlight` for
   * selection.
   */
  private readonly localPending = new Map<string, number>();

  constructor(private readonly deps: DispatcherDeps) {}

  async dispatch(request: ChatCompletionRequest, apiKeyId: string): Promise<ChatCompletion> {
    const jobId = generateJobId();
    const createdAtIso = new Date(this.now()).toISOString();
    await this.deps.jobsState.create({
      id: jobId,
      apiKeyId,
      workerPubKey: null,
      status: 'pending',
      createdAt: createdAtIso,
      updatedAt: createdAtIso,
      tokensIn: null,
      tokensOut: null,
    });

    const tried = new Set<string>();
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const worker = await this.selectWorker(tried);
      if (!worker) {
        if (attempt === 0) {
          await this.markFailed(jobId);
          throw new DomainError({
            statusCode: 503,
            code: ERROR_CODE.noWorkersAvailable,
            message: 'No workers are currently available to serve the request.',
          });
        }
        break;
      }
      tried.add(worker.pubKey);
      this.incrementPending(worker.pubKey);
      try {
        await this.deps.jobsState.transition(jobId, {
          status: 'dispatched',
          workerPubKey: worker.pubKey,
        });
        logEvent(this.deps.log, AUDIT_EVENT.inferenceDispatched, {
          jobId,
          apiKeyId,
          workerPubKey: worker.pubKey,
          attempt,
        });
        await this.deps.jobsState.transition(jobId, { status: 'running' });

        const response = await this.deps.rpcClient.request<InferenceRequest, InferenceResponse>(
          Buffer.from(worker.pubKey, 'hex'),
          RPC_METHOD.inferenceRun,
          buildInferenceRequest(request, apiKeyId, jobId),
          {
            requestEncoding: inferenceRequestCodec,
            responseEncoding: inferenceResponseCodec,
          },
        );

        if (response.kind !== 'final') {
          throw new Error(`expected final response from worker; got kind=${response.kind}`);
        }
        const finalEnvelope: InferenceResponseFinal = response;

        await this.deps.jobsState.transition(jobId, {
          status: 'complete',
          tokensIn: finalEnvelope.promptTokens,
          tokensOut: finalEnvelope.completionTokens,
        });
        logEvent(this.deps.log, AUDIT_EVENT.inferenceCompleted, {
          jobId,
          apiKeyId,
          workerPubKey: worker.pubKey,
          finishReason: finalEnvelope.finishReason,
          completionTokens: finalEnvelope.completionTokens,
        });
        return mapToChatCompletion(finalEnvelope, request, jobId, this.now());
      } catch (err) {
        lastError = err;
        logEvent(this.deps.log, AUDIT_EVENT.inferenceFailed, {
          jobId,
          apiKeyId,
          workerPubKey: worker.pubKey,
          attempt,
          err: err instanceof Error ? err.message : String(err),
        });
      } finally {
        this.decrementPending(worker.pubKey);
      }
    }

    await this.markFailed(jobId);
    throw new DomainError({
      statusCode: 503,
      code: ERROR_CODE.workerTimeout,
      message: 'Inference dispatch failed after retries.',
      details:
        lastError !== undefined
          ? { cause: lastError instanceof Error ? lastError.message : String(lastError) }
          : undefined,
    });
  }

  /**
   * Streaming variant of `dispatch`. Single-attempt selection (no retry,
   * because the architecture doc commits to surfacing mid-stream worker
   * failure to the client rather than reconnecting silently). Yields each
   * worker frame in order; the consumer (the chat-completions route) maps
   * `chunk` frames to `ChatCompletionChunk`s and the trailing `final` frame
   * to the SSE `[DONE]` terminator. Cancellation is wired through `signal`.
   */
  async *dispatchStream(
    request: ChatCompletionRequest,
    apiKeyId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<InferenceResponse, void, void> {
    if (!this.deps.streamTransport) {
      throw new DomainError({
        statusCode: 501,
        code: ERROR_CODE.internalError,
        message: 'Streaming transport is not configured.',
      });
    }
    const transport = this.deps.streamTransport;

    const jobId = generateJobId();
    const createdAtIso = new Date(this.now()).toISOString();
    await this.deps.jobsState.create({
      id: jobId,
      apiKeyId,
      workerPubKey: null,
      status: 'pending',
      createdAt: createdAtIso,
      updatedAt: createdAtIso,
      tokensIn: null,
      tokensOut: null,
    });

    const worker = await this.selectWorker(new Set());
    if (!worker) {
      await this.markFailed(jobId);
      throw new DomainError({
        statusCode: 503,
        code: ERROR_CODE.noWorkersAvailable,
        message: 'No workers are currently available to serve the request.',
      });
    }

    this.incrementPending(worker.pubKey);
    let final: InferenceResponseFinal | null = null;
    let crashed: unknown;
    try {
      await this.deps.jobsState.transition(jobId, {
        status: 'dispatched',
        workerPubKey: worker.pubKey,
      });
      logEvent(this.deps.log, AUDIT_EVENT.inferenceDispatched, {
        jobId,
        apiKeyId,
        workerPubKey: worker.pubKey,
        attempt: 0,
        streaming: true,
      });
      await this.deps.jobsState.transition(jobId, { status: 'running' });

      const wireRequest = buildInferenceRequest(request, apiKeyId, jobId);
      const stream = transport.openStream(Buffer.from(worker.pubKey, 'hex'), wireRequest, signal);

      for await (const frame of stream) {
        if (frame.kind === 'final') final = frame;
        yield frame;
        if (frame.kind === 'final') break;
      }

      if (!final) {
        crashed = new Error('worker stream ended without a final envelope');
      }
    } catch (err) {
      crashed = err;
    } finally {
      this.decrementPending(worker.pubKey);
    }

    if (crashed) {
      await this.markFailed(jobId);
      logEvent(this.deps.log, AUDIT_EVENT.inferenceFailed, {
        jobId,
        apiKeyId,
        workerPubKey: worker.pubKey,
        streaming: true,
        err: crashed instanceof Error ? crashed.message : String(crashed),
      });
      if (crashed instanceof DomainError) throw crashed;
      throw new DomainError({
        statusCode: 503,
        code: ERROR_CODE.workerTimeout,
        message: 'Streaming inference failed.',
        details: { cause: crashed instanceof Error ? crashed.message : String(crashed) },
      });
    }

    await this.deps.jobsState.transition(jobId, {
      status: 'complete',
      tokensIn: final!.promptTokens,
      tokensOut: final!.completionTokens,
    });
    logEvent(this.deps.log, AUDIT_EVENT.inferenceCompleted, {
      jobId,
      apiKeyId,
      workerPubKey: worker.pubKey,
      finishReason: final!.finishReason,
      completionTokens: final!.completionTokens,
      streaming: true,
    });
  }

  /** Test seam — exposes the local pending map size for assertions. */
  pendingFor(workerPubKey: string): number {
    return this.localPending.get(workerPubKey) ?? 0;
  }

  private async selectWorker(excluded: Set<string>): Promise<WorkerRecord | null> {
    const candidates: WorkerRecord[] = [];
    for await (const w of this.deps.workersState.list()) {
      if (excluded.has(w.pubKey)) continue;
      candidates.push(w);
    }
    if (candidates.length === 0) return null;
    const random = this.deps.random ?? Math.random;
    // Map each candidate to a stable, symmetric sort key so the comparator
    // never returns the same sign in both directions for equal-load workers.
    const ranked = candidates
      .map((w) => ({
        w,
        load: w.inFlight + (this.localPending.get(w.pubKey) ?? 0),
        tieBreak: random(),
      }))
      .sort((a, b) => (a.load !== b.load ? a.load - b.load : a.tieBreak - b.tieBreak));
    return ranked[0]?.w ?? null;
  }

  private incrementPending(pubKey: string): void {
    this.localPending.set(pubKey, (this.localPending.get(pubKey) ?? 0) + 1);
  }

  private decrementPending(pubKey: string): void {
    const next = (this.localPending.get(pubKey) ?? 0) - 1;
    if (next <= 0) this.localPending.delete(pubKey);
    else this.localPending.set(pubKey, next);
  }

  private async markFailed(jobId: string): Promise<JobRecord | null> {
    return this.deps.jobsState.transition(jobId, { status: 'failed' });
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }
}

function generateJobId(): string {
  return `job_${randomBytes(8).toString('hex')}`;
}

function buildInferenceRequest(
  request: ChatCompletionRequest,
  apiKeyId: string,
  jobId: string,
): InferenceRequest {
  return {
    jobId,
    apiKeyId,
    requestId: jobId,
    model: request.model,
    messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    stream: false,
    ...(typeof request.temperature === 'number' ? { temperature: request.temperature } : {}),
    ...(typeof request.top_p === 'number' ? { topP: request.top_p } : {}),
    ...(typeof request.max_tokens === 'number' ? { maxTokens: request.max_tokens } : {}),
  };
}

function mapToChatCompletion(
  final: InferenceResponseFinal,
  request: ChatCompletionRequest,
  jobId: string,
  nowMs: number,
): ChatCompletion {
  return {
    id: jobId,
    object: 'chat.completion',
    created: Math.floor(nowMs / 1000),
    model: request.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: final.text ?? '' },
        finish_reason: final.finishReason,
      },
    ],
    usage: {
      prompt_tokens: final.promptTokens,
      completion_tokens: final.completionTokens,
      total_tokens: final.promptTokens + final.completionTokens,
    },
  };
}
