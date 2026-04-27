import { decode, encode, workerHealthCodec } from '@cosmic/shared';
import { describe, expect, it } from 'vitest';

import { buildHealthSnapshot } from './health.handler.js';

describe('buildHealthSnapshot', () => {
  it('returns a snapshot conforming to the WorkerHealth codec', () => {
    const snap = buildHealthSnapshot({
      workerId: 'worker-1',
      workerPubKey: 'aabbccdd',
      capacity: 4,
      inFlight: () => 2,
      startedAt: 1_000_000,
      modelId: 'mock-llm',
      now: () => 1_005_000,
    });
    expect(snap).toEqual({
      workerId: 'worker-1',
      workerPubKey: 'aabbccdd',
      capacity: 4,
      inFlight: 2,
      uptimeSeconds: 5,
      modelId: 'mock-llm',
    });
    // Round-trip through the wire codec to prove shape compatibility.
    const buf = encode(workerHealthCodec, snap);
    expect(decode(workerHealthCodec, buf)).toEqual(snap);
  });

  it('clamps a negative uptime to zero', () => {
    const snap = buildHealthSnapshot({
      workerId: 'w',
      workerPubKey: 'aa',
      capacity: 1,
      inFlight: () => 0,
      startedAt: 2_000,
      modelId: 'mock-llm',
      now: () => 1_000,
    });
    expect(snap.uptimeSeconds).toBe(0);
  });

  it('reads inFlight lazily on each call', () => {
    let counter = 0;
    const snap1 = buildHealthSnapshot({
      workerId: 'w',
      workerPubKey: 'aa',
      capacity: 1,
      inFlight: () => ++counter,
      startedAt: 0,
      modelId: 'mock-llm',
      now: () => 1_000,
    });
    const snap2 = buildHealthSnapshot({
      workerId: 'w',
      workerPubKey: 'aa',
      capacity: 1,
      inFlight: () => ++counter,
      startedAt: 0,
      modelId: 'mock-llm',
      now: () => 1_000,
    });
    expect(snap1.inFlight).toBe(1);
    expect(snap2.inFlight).toBe(2);
  });
});
