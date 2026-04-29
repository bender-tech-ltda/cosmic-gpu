import { describe, expect, it } from 'vitest';

import { InMemoryKvStore } from './in-memory.adapter.js';
import { WorkersState, type WorkerRecord } from './workers.state.js';

const fixture = (overrides: Partial<WorkerRecord> = {}): WorkerRecord => ({
  id: 'worker-x',
  pubKey: '00'.repeat(32),
  lastSeen: '2024-01-01T00:00:00.000Z',
  capacity: 4,
  inFlight: 0,
  modelId: 'mock-llm',
  ...overrides,
});

describe('WorkersState.totalCapacity', () => {
  it('returns 0 on an empty state', () => {
    const state = new WorkersState(new InMemoryKvStore());
    expect(state.totalCapacity()).toBe(0);
  });

  it('sums capacity across upserts (insert path)', async () => {
    const state = new WorkersState(new InMemoryKvStore());
    await state.upsert(fixture({ pubKey: 'a'.repeat(64), capacity: 4 }));
    await state.upsert(fixture({ pubKey: 'b'.repeat(64), capacity: 8 }));
    await state.upsert(fixture({ pubKey: 'c'.repeat(64), capacity: 2 }));
    expect(state.totalCapacity()).toBe(14);
  });

  it('treats upsert of an existing pubKey as an update (no double-count)', async () => {
    const state = new WorkersState(new InMemoryKvStore());
    const pub = 'a'.repeat(64);
    await state.upsert(fixture({ pubKey: pub, capacity: 4 }));
    await state.upsert(fixture({ pubKey: pub, capacity: 10 }));
    expect(state.totalCapacity()).toBe(10);
  });

  it('subtracts capacity on remove', async () => {
    const state = new WorkersState(new InMemoryKvStore());
    await state.upsert(fixture({ pubKey: 'a'.repeat(64), capacity: 4 }));
    await state.upsert(fixture({ pubKey: 'b'.repeat(64), capacity: 8 }));
    await state.remove('a'.repeat(64));
    expect(state.totalCapacity()).toBe(8);
  });

  it('remove of an unknown pubKey is a no-op', async () => {
    const state = new WorkersState(new InMemoryKvStore());
    await state.upsert(fixture({ pubKey: 'a'.repeat(64), capacity: 4 }));
    await state.remove('z'.repeat(64));
    expect(state.totalCapacity()).toBe(4);
  });
});

describe('WorkersState.hydrate', () => {
  it('seeds the in-memory mirror from previously persisted records', async () => {
    const kv = new InMemoryKvStore();

    // Pretend an earlier process wrote two workers to the KV.
    const seeded = new WorkersState(kv);
    await seeded.upsert(fixture({ pubKey: 'a'.repeat(64), capacity: 4 }));
    await seeded.upsert(fixture({ pubKey: 'b'.repeat(64), capacity: 6 }));

    // Brand new instance over the same KV: cache starts at 0 until hydrate.
    const fresh = new WorkersState(kv);
    expect(fresh.totalCapacity()).toBe(0);
    await fresh.hydrate();
    expect(fresh.totalCapacity()).toBe(10);
  });

  it('is idempotent (clears + reseeds without double-counting)', async () => {
    const kv = new InMemoryKvStore();
    const state = new WorkersState(kv);
    await state.upsert(fixture({ pubKey: 'a'.repeat(64), capacity: 4 }));

    await state.hydrate();
    await state.hydrate();
    expect(state.totalCapacity()).toBe(4);
  });
});
