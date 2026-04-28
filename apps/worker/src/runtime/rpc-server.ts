// Hyperswarm RPC server wiring.
//
// Registers the request/response methods (`inference.run`, `worker.health`)
// with their Compact Encoding codecs from `@cosmic/shared`. Streaming
// (`inference.stream`) is a separate Protomux-based path that lands in
// Step 7; the streaming handler itself already exists and is unit-tested,
// it just isn't wired to a transport here yet.

import HyperswarmRPC, { type RpcServer } from '@hyperswarm/rpc';
import {
  RPC_METHOD,
  inferenceRequestCodec,
  inferenceResponseCodec,
  workerHealthCodec,
  type InferenceRequest,
  type InferenceResponse,
  type WorkerHealth,
} from '@cosmic/shared';
import type { Logger } from 'pino';

import { WORKER_AUDIT_EVENT, logEvent } from '../observability/logger.js';
import { buildHealthSnapshot, type WorkerHealthDeps } from '../handlers/health.handler.js';
import { runInference, type InferenceHandlerDeps } from '../handlers/inference.handler.js';
import type { WorkerIdentity } from './identity.js';

export interface RpcServerHandle {
  server: RpcServer;
  rpc: HyperswarmRPC;
  close: () => Promise<void>;
}

export interface RpcServerDeps {
  identity: WorkerIdentity;
  log: Logger;
  /** Source of the worker.health snapshot. */
  health: WorkerHealthDeps;
  /** Source of the inference.run handler. */
  inference: InferenceHandlerDeps;
}

export async function startRpcServer(deps: RpcServerDeps): Promise<RpcServerHandle> {
  // Per `@hyperswarm/rpc` docs, the `dht` option "defaults to a new
  // instance." We deliberately let RPC build its own DHT (rather than
  // reusing the swarm's): HyperDHT enforces "one listener per keypair per
  // DHT instance", and our swarm already calls `dht.createServer().listen(
  // identity)` via `swarm.join({ server: true })`. Reusing the same DHT
  // would cause `KEYPAIR_ALREADY_USED`.
  const rpc = new HyperswarmRPC({
    keyPair: { publicKey: deps.identity.publicKey, secretKey: deps.identity.secretKey },
  });

  const server = rpc.createServer();

  server.respond<InferenceRequest, InferenceResponse>(
    RPC_METHOD.inferenceRun,
    {
      requestEncoding: inferenceRequestCodec,
      responseEncoding: inferenceResponseCodec,
    },
    async (request) => {
      logEvent(deps.log, WORKER_AUDIT_EVENT.inferenceDispatched, {
        jobId: request.jobId,
        apiKeyId: request.apiKeyId,
        requestId: request.requestId,
      });
      try {
        const final = await runInference(request, deps.inference);
        logEvent(deps.log, WORKER_AUDIT_EVENT.inferenceCompleted, {
          jobId: request.jobId,
          finishReason: final.finishReason,
          completionTokens: final.completionTokens,
        });
        return final;
      } catch (err) {
        logEvent(deps.log, WORKER_AUDIT_EVENT.inferenceFailed, {
          jobId: request.jobId,
          err: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
  );

  server.respond<undefined, WorkerHealth>(
    RPC_METHOD.workerHealth,
    { responseEncoding: workerHealthCodec },
    async () => buildHealthSnapshot(deps.health),
  );

  await server.listen({
    publicKey: deps.identity.publicKey,
    secretKey: deps.identity.secretKey,
  });

  return {
    server,
    rpc,
    close: async () => {
      try {
        await server.close();
      } catch {
        /* noop */
      }
      await rpc.destroy();
    },
  };
}
