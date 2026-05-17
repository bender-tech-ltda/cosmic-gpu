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
import type { BootstrapNode } from './bootstrap.js';
import type { WorkerIdentity } from './identity.js';

// Zero-byte request codec for `worker.health`. Must match the backend's
// `HEALTH_REQUEST_CODEC` in `apps/backend/src/p2p/registry.ts`. Without
// this, the RPC framework falls back to a default encoding that throws
// `DECODE_ERROR: Out of bounds` when it tries to read the empty payload
// the backend sends.
const HEALTH_REQUEST_CODEC = {
  preencode(): void {},
  encode(): void {},
  decode(): undefined {
    return undefined;
  },
};

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
  /**
   * Parsed `P2P_BOOTSTRAP` list. The RPC server builds its own HyperDHT
   * (see comment in `startRpcServer`); without forwarding the same
   * bootstrap nodes the swarm uses, the RPC DHT silently falls back to
   * the public Holepunch mainnet. Inside Docker Compose that means the
   * RPC listener is registered on a different routing topology from the
   * backend's lookups — backend `dht.connect(workerPubKey)` resolves
   * nothing, producing `RPCError: CHANNEL_CLOSED`/`CHANNEL_DESTROYED`
   * and the soft-removal loop the reviewer hit. Undefined ⇒ inherit
   * mainnet defaults (native dev, no Compose).
   */
  bootstrap?: BootstrapNode[];
}

export async function startRpcServer(deps: RpcServerDeps): Promise<RpcServerHandle> {
  // Per `@hyperswarm/rpc` docs, the `dht` option "defaults to a new
  // instance." We deliberately let RPC build its own DHT (rather than
  // reusing the swarm's): HyperDHT enforces "one listener per keypair per
  // DHT instance", and our swarm already calls `dht.createServer().listen(
  // identity)` via `swarm.join({ server: true })`. Reusing the same DHT
  // would cause `KEYPAIR_ALREADY_USED`.
  //
  // We DO forward `bootstrap` so this fresh DHT joins the same routing
  // topology as the swarm. See `RpcServerDeps.bootstrap` JSDoc.
  const rpc = new HyperswarmRPC({
    keyPair: { publicKey: deps.identity.publicKey, secretKey: deps.identity.secretKey },
    ...(deps.bootstrap !== undefined ? { bootstrap: deps.bootstrap } : {}),
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
    {
      requestEncoding: HEALTH_REQUEST_CODEC,
      responseEncoding: workerHealthCodec,
    },
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
