import { RPC_METHOD, type WorkerHealth } from '@cosmic/shared';
import type { FastifyBaseLogger } from 'fastify';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import { InMemoryKvStore } from '../state/in-memory.adapter.js';
import { WorkersState } from '../state/workers.state.js';
import { WorkerRegistry } from './registry.js';
import type { RpcClient } from './rpc-client.js';

function fakeLog(): FastifyBaseLogger {
  const noop = (): void => {};
  return {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: () => fakeLog(),
    level: 'info',
  } as unknown as FastifyBaseLogger;
}

function fakeSwarm(): EventEmitter {
  return new EventEmitter();
}

function healthSnapshot(overrides: Partial<WorkerHealth> = {}): WorkerHealth {
  return {
    workerId: 'worker-x',
    workerPubKey: '00'.repeat(32),
    capacity: 4,
    inFlight: 0,
    uptimeSeconds: 1,
    modelId: 'mock-llm',
    ...overrides,
  };
}

function makeClient(handler: (method: string) => Promise<unknown>): RpcClient {
  return {
    async request(_pub, method) {
      return handler(method) as never;
    },
    async close() {},
  };
}

const PUB = Buffer.alloc(32, 0x42);
const PUB_HEX = PUB.toString('hex');

describe('WorkerRegistry', () => {
  it('polls health on connection and upserts the worker record', async () => {
    const swarm = fakeSwarm();
    const kv = new InMemoryKvStore();
    const workers = new WorkersState(kv);
    const client = makeClient(async (method) => {
      expect(method).toBe(RPC_METHOD.workerHealth);
      return healthSnapshot({ workerPubKey: PUB_HEX, workerId: 'worker-1' });
    });
    const registry = new WorkerRegistry({
      swarm: swarm as unknown as Parameters<typeof WorkerRegistry>[0]['swarm'],
      rpcClient: client,
      workersState: workers,
      log: fakeLog(),
      pollIntervalMs: 60_000,
      setInterval: ((): ReturnType<typeof setInterval> =>
        ({ unref: (): void => {} }) as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearInterval: (() => {}) as typeof clearInterval,
    });
    registry.start();

    await registry.registerPeer(PUB);
    expect(registry.size()).toBe(1);

    const stored = await workers.findByPubKey(PUB_HEX);
    expect(stored?.id).toBe('worker-1');
    expect(stored?.modelId).toBe('mock-llm');
  });

  it('soft-removes a worker after the failure threshold is reached', async () => {
    const swarm = fakeSwarm();
    const kv = new InMemoryKvStore();
    const workers = new WorkersState(kv);
    let calls = 0;
    const client = makeClient(async () => {
      calls += 1;
      if (calls === 1) return healthSnapshot({ workerPubKey: PUB_HEX });
      throw new Error('peer is down');
    });
    const registry = new WorkerRegistry({
      swarm: swarm as unknown as Parameters<typeof WorkerRegistry>[0]['swarm'],
      rpcClient: client,
      workersState: workers,
      log: fakeLog(),
      pollIntervalMs: 60_000,
      failureThreshold: 3,
      setInterval: (() =>
        ({ unref: (): void => {} }) as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearInterval: (() => {}) as typeof clearInterval,
    });
    registry.start();

    await registry.registerPeer(PUB); // call 1: success
    expect(registry.size()).toBe(1);
    expect(await workers.findByPubKey(PUB_HEX)).not.toBeNull();

    // Trigger 3 polls; after the third, the worker is soft-removed.
    await registry.registerPeer(PUB); // call 2: failure (failures=1)
    await registry.registerPeer(PUB); // call 3: failure (failures=2)
    await registry.registerPeer(PUB); // call 4: failure (failures=3) → remove
    expect(registry.size()).toBe(0);
    expect(await workers.findByPubKey(PUB_HEX)).toBeNull();
  });

  it('attaches a connection listener when start() is called', () => {
    const swarm = fakeSwarm();
    const onSpy = vi.spyOn(swarm, 'on');
    const registry = new WorkerRegistry({
      swarm: swarm as unknown as Parameters<typeof WorkerRegistry>[0]['swarm'],
      rpcClient: makeClient(async () => healthSnapshot()),
      workersState: new WorkersState(new InMemoryKvStore()),
      log: fakeLog(),
      pollIntervalMs: 60_000,
      setInterval: (() =>
        ({ unref: (): void => {} }) as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearInterval: (() => {}) as typeof clearInterval,
    });
    registry.start();
    expect(onSpy).toHaveBeenCalledWith('connection', expect.any(Function));
  });
});
