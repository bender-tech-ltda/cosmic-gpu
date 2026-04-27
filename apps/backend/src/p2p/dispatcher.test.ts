import {
  ERROR_CODE,
  RPC_METHOD,
  type ChatCompletionRequest,
  type InferenceRequest,
  type InferenceResponse,
} from '@cosmic/shared';
import { describe, expect, it, vi } from 'vitest';

import type { DomainError } from '../errors/domain-error.js';
import type { AuditLogger } from '../observability/audit.js';
import { JobsState } from '../state/jobs.state.js';
import { InMemoryKvStore } from '../state/in-memory.adapter.js';
import { WorkersState, type WorkerRecord } from '../state/workers.state.js';
import { InferenceDispatcher } from './dispatcher.js';
import type { RpcClient, RpcCodecs } from './rpc-client.js';

function fakeLogger(): { log: AuditLogger; info: ReturnType<typeof vi.fn> } {
  const info = vi.fn();
  return { log: { info } as unknown as AuditLogger, info };
}

interface RpcCall {
  pubKey: string;
  method: string;
  request: InferenceRequest;
}

function makeRpcStub(handler: (call: RpcCall) => Promise<InferenceResponse>): {
  client: RpcClient;
  calls: RpcCall[];
} {
  const calls: RpcCall[] = [];
  const client: RpcClient = {
    async request<TReq, TRes>(
      pub: Buffer,
      method: string,
      value: TReq,
      _codecs: RpcCodecs<TReq, TRes>,
    ): Promise<TRes> {
      const call: RpcCall = {
        pubKey: pub.toString('hex'),
        method,
        request: value as unknown as InferenceRequest,
      };
      calls.push(call);
      return (await handler(call)) as unknown as TRes;
    },
    close: vi.fn(async () => {}),
  };
  return { client, calls };
}

const PUB_HEX_A = 'aa'.repeat(32);
const PUB_HEX_B = 'bb'.repeat(32);

function workerRecord(pubKey: string, inFlight: number, modelId = 'mock-llm'): WorkerRecord {
  return {
    id: `worker-${pubKey.slice(0, 4)}`,
    pubKey,
    lastSeen: new Date().toISOString(),
    capacity: 4,
    inFlight,
    modelId,
  };
}

function fixtureRequest(overrides: Partial<ChatCompletionRequest> = {}): ChatCompletionRequest {
  return {
    model: 'mock-llm',
    messages: [{ role: 'user', content: 'hi' }],
    ...overrides,
  };
}

async function bootstrap(): Promise<{
  workers: WorkersState;
  jobs: JobsState;
}> {
  const kv = new InMemoryKvStore();
  return { workers: new WorkersState(kv), jobs: new JobsState(kv) };
}

describe('InferenceDispatcher', () => {
  it('throws noWorkersAvailable when the registry is empty', async () => {
    const { workers, jobs } = await bootstrap();
    const { client } = makeRpcStub(async () => {
      throw new Error('should not be called');
    });
    const { log } = fakeLogger();
    const dispatcher = new InferenceDispatcher({
      rpcClient: client,
      workersState: workers,
      jobsState: jobs,
      log,
    });

    await expect(dispatcher.dispatch(fixtureRequest(), 'ak_test')).rejects.toMatchObject({
      code: ERROR_CODE.noWorkersAvailable,
      statusCode: 503,
    });

    // Job should be marked failed.
    const allJobs: Array<{ status: string }> = [];
    for await (const j of jobs.list()) allJobs.push(j);
    expect(allJobs).toHaveLength(1);
    expect(allJobs[0]?.status).toBe('failed');
  });

  it('selects the worker with the lowest in-flight + local pending', async () => {
    const { workers, jobs } = await bootstrap();
    await workers.upsert(workerRecord(PUB_HEX_A, 5)); // busier
    await workers.upsert(workerRecord(PUB_HEX_B, 1)); // less loaded
    const { client, calls } = makeRpcStub(async (call) => ({
      kind: 'final',
      jobId: call.request.jobId,
      finishReason: 'stop',
      promptTokens: 1,
      completionTokens: 2,
      workerPubKey: call.pubKey,
      text: 'hi',
    }));
    const { log } = fakeLogger();
    const dispatcher = new InferenceDispatcher({
      rpcClient: client,
      workersState: workers,
      jobsState: jobs,
      log,
    });

    const result = await dispatcher.dispatch(fixtureRequest(), 'ak_test');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.pubKey).toBe(PUB_HEX_B);
    expect(calls[0]?.method).toBe(RPC_METHOD.inferenceRun);
    expect(result.choices[0]?.message.content).toBe('hi');
    expect(result.usage.total_tokens).toBe(3);

    // Local pending fully released.
    expect(dispatcher.pendingFor(PUB_HEX_B)).toBe(0);
  });

  it('re-dispatches once on RPC failure and succeeds on the second worker', async () => {
    const { workers, jobs } = await bootstrap();
    await workers.upsert(workerRecord(PUB_HEX_A, 0));
    await workers.upsert(workerRecord(PUB_HEX_B, 0));
    let attempt = 0;
    const { client, calls } = makeRpcStub(async (call) => {
      attempt += 1;
      if (attempt === 1) throw new Error('worker A blew up');
      return {
        kind: 'final',
        jobId: call.request.jobId,
        finishReason: 'stop',
        promptTokens: 1,
        completionTokens: 4,
        workerPubKey: call.pubKey,
        text: 'recovered',
      };
    });
    const { log } = fakeLogger();
    const dispatcher = new InferenceDispatcher({
      rpcClient: client,
      workersState: workers,
      jobsState: jobs,
      log,
      // Tie-break deterministically: pick A first.
      random: () => 0,
    });

    const result = await dispatcher.dispatch(fixtureRequest(), 'ak_test');
    expect(calls.map((c) => c.pubKey)).toEqual([PUB_HEX_A, PUB_HEX_B]);
    expect(result.choices[0]?.message.content).toBe('recovered');
  });

  it('throws workerTimeout after the second failure', async () => {
    const { workers, jobs } = await bootstrap();
    await workers.upsert(workerRecord(PUB_HEX_A, 0));
    await workers.upsert(workerRecord(PUB_HEX_B, 0));
    const { client } = makeRpcStub(async () => {
      throw new Error('boom');
    });
    const { log, info } = fakeLogger();
    const dispatcher = new InferenceDispatcher({
      rpcClient: client,
      workersState: workers,
      jobsState: jobs,
      log,
      random: () => 0,
    });

    let captured: DomainError | undefined;
    try {
      await dispatcher.dispatch(fixtureRequest(), 'ak_test');
    } catch (err) {
      captured = err as DomainError;
    }
    expect(captured?.code).toBe(ERROR_CODE.workerTimeout);
    expect(captured?.statusCode).toBe(503);

    // Lifecycle: pending → dispatched → running → failed (final state).
    const recorded: Array<{ status: string }> = [];
    for await (const j of jobs.list()) recorded.push(j);
    expect(recorded[0]?.status).toBe('failed');

    // Two `inference.failed` events were emitted (one per attempt).
    const failedEvents = info.mock.calls.filter(
      ([fields]) => (fields as { event?: string }).event === 'inference.failed',
    );
    expect(failedEvents).toHaveLength(2);
  });

  it('writes lifecycle transitions and emits dispatched/completed audit events on success', async () => {
    const { workers, jobs } = await bootstrap();
    await workers.upsert(workerRecord(PUB_HEX_A, 0));
    const { client } = makeRpcStub(async (call) => ({
      kind: 'final',
      jobId: call.request.jobId,
      finishReason: 'stop',
      promptTokens: 2,
      completionTokens: 3,
      workerPubKey: call.pubKey,
      text: 'ok',
    }));
    const { log, info } = fakeLogger();
    const dispatcher = new InferenceDispatcher({
      rpcClient: client,
      workersState: workers,
      jobsState: jobs,
      log,
    });

    await dispatcher.dispatch(fixtureRequest(), 'ak_test');

    const final: Array<{ status: string; tokensIn: number | null; tokensOut: number | null }> = [];
    for await (const j of jobs.list()) final.push(j);
    expect(final[0]?.status).toBe('complete');
    expect(final[0]?.tokensIn).toBe(2);
    expect(final[0]?.tokensOut).toBe(3);

    const events = info.mock.calls.map(([fields]) => (fields as { event?: string }).event);
    expect(events).toContain('inference.dispatched');
    expect(events).toContain('inference.completed');
  });

  it('rejects a non-final RPC response shape', async () => {
    const { workers, jobs } = await bootstrap();
    await workers.upsert(workerRecord(PUB_HEX_A, 0));
    await workers.upsert(workerRecord(PUB_HEX_B, 0));
    const { client } = makeRpcStub(async (call) => ({
      kind: 'chunk',
      jobId: call.request.jobId,
      delta: 'oops',
    }));
    const { log } = fakeLogger();
    const dispatcher = new InferenceDispatcher({
      rpcClient: client,
      workersState: workers,
      jobsState: jobs,
      log,
      random: () => 0,
    });

    await expect(dispatcher.dispatch(fixtureRequest(), 'ak_test')).rejects.toMatchObject({
      code: ERROR_CODE.workerTimeout,
    });
  });
});
