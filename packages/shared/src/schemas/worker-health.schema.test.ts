import { describe, expect, it } from 'vitest';
import { decode, encode } from './codec.helpers.js';
import { workerHealthCodec, type WorkerHealth } from './worker-health.schema.js';

describe('workerHealthCodec', () => {
  it('round-trips a worker health snapshot', () => {
    const original: WorkerHealth = {
      workerId: 'worker-1',
      workerPubKey: 'abcd1234',
      capacity: 4,
      inFlight: 2,
      uptimeSeconds: 3600,
      modelId: 'mock-llm',
    };
    const buf = encode(workerHealthCodec, original);
    const decoded = decode(workerHealthCodec, buf);
    expect(decoded).toEqual(original);
  });

  it('round-trips a freshly-started worker (zero counters, empty pubKey)', () => {
    const original: WorkerHealth = {
      workerId: 'worker-2',
      workerPubKey: '',
      capacity: 0,
      inFlight: 0,
      uptimeSeconds: 0,
      modelId: 'mock-llm',
    };
    const buf = encode(workerHealthCodec, original);
    expect(decode(workerHealthCodec, buf)).toEqual(original);
  });

  it('round-trips multi-byte UTF-8 in workerId / modelId', () => {
    const original: WorkerHealth = {
      workerId: 'worker-🌌-1',
      workerPubKey: 'aabbcc',
      capacity: 2,
      inFlight: 1,
      uptimeSeconds: 99,
      modelId: 'mock-漢字-llm',
    };
    const buf = encode(workerHealthCodec, original);
    expect(decode(workerHealthCodec, buf)).toEqual(original);
  });
});
