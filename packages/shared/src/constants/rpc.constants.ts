/**
 * Hyperswarm RPC method identifiers, exported as a typed const map so both
 * backend and worker reference the same string literals.
 */
export const RPC_METHOD = {
  inferenceRun: 'inference.run',
  inferenceStream: 'inference.stream',
  workerHealth: 'worker.health',
} as const;

export type RpcMethod = (typeof RPC_METHOD)[keyof typeof RPC_METHOD];
