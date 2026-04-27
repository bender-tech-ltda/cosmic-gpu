// Compact Encoding schema for the `worker.health` RPC method.
// SCHEMA EVOLUTION POLICY: APPEND-ONLY.

import { cstring, cuint, defineObject, type Codec } from './codec.helpers.js';

export interface WorkerHealth {
  workerId: string;
  workerPubKey: string;
  /** Maximum concurrent inference jobs the worker advertises. */
  capacity: number;
  /** Current number of in-flight inference jobs. */
  inFlight: number;
  /** Worker process uptime in seconds (monotonic). */
  uptimeSeconds: number;
  /** Model id this worker serves (e.g. "mock-llm"). */
  modelId: string;
}

export const workerHealthCodec: Codec<WorkerHealth> = defineObject({
  workerId: cstring,
  workerPubKey: cstring,
  capacity: cuint,
  inFlight: cuint,
  uptimeSeconds: cuint,
  modelId: cstring,
});
