// `worker.health` handler.
//
// The backend dispatcher (Step 6) polls each worker via the Hyperswarm RPC
// `worker.health` method to refresh `workers/<pubkey>` rows in the registry.
// This module is a pure function so we can unit-test it with no Hyperswarm.

import type { WorkerHealth } from '@cosmic/shared';

export interface WorkerHealthDeps {
  workerId: string;
  /** Hex-encoded public key. The wire codec carries it as a string field. */
  workerPubKey: string;
  capacity: number;
  /** Returns the current number of in-flight inference jobs. */
  inFlight: () => number;
  /** `Date.now()` at process boot, monotonic across the worker lifetime. */
  startedAt: number;
  modelId: string;
  /** Injectable clock so tests can pin uptimeSeconds. */
  now?: () => number;
}

export function buildHealthSnapshot(deps: WorkerHealthDeps): WorkerHealth {
  const now = deps.now ?? Date.now;
  const uptimeSeconds = Math.max(0, Math.floor((now() - deps.startedAt) / 1000));
  return {
    workerId: deps.workerId,
    workerPubKey: deps.workerPubKey,
    capacity: deps.capacity,
    inFlight: deps.inFlight(),
    uptimeSeconds,
    modelId: deps.modelId,
  };
}
