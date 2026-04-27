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
});
