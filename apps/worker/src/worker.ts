// Worker entrypoint.
//
// Wires:  config -> identity -> Hyperswarm join -> @hyperswarm/rpc server
// with `inference.run` and `worker.health` handlers. Graceful SIGINT /
// SIGTERM shutdown closes everything in reverse order.

import { loadConfig } from './config/env.config.js';
import { runInference } from './handlers/inference.handler.js';
import { WORKER_AUDIT_EVENT, buildLogger, logEvent } from './observability/logger.js';
import { installP2pErrorGuards } from './runtime/error-guards.js';
import { loadOrGenerateIdentity } from './runtime/identity.js';
import { startRpcServer } from './runtime/rpc-server.js';
import { attachStreamChannelServer } from './runtime/stream-channel.js';
import { joinSwarm } from './runtime/swarm.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const log = buildLogger(config);
  const startedAt = Date.now();

  // Top-level guard for stream-level peer errors that escape per-stream
  // handlers. See `runtime/error-guards.ts` for the rationale.
  installP2pErrorGuards(log);

  log.info(
    { node: process.version, model: config.WORKER_MODEL_ID, capacity: config.WORKER_CAPACITY },
    'worker.boot',
  );

  const identity = await loadOrGenerateIdentity(config.NODE_KEYPAIR_PATH);
  log.info({ pubKey: identity.publicKeyShort }, 'identity.loaded');

  const swarmHandle = await joinSwarm(config, identity, log);
  logEvent(log, WORKER_AUDIT_EVENT.workerJoined, {
    pubKey: identity.publicKeyShort,
    workerId: config.WORKER_ID,
    capacity: config.WORKER_CAPACITY,
    modelId: config.WORKER_MODEL_ID,
  });

  // In-flight job counter, shared between non-streaming and (future) streaming handlers.
  let inFlight = 0;
  const inFlightCounter = {
    increment: (): void => {
      inFlight += 1;
    },
    decrement: (): void => {
      inFlight = Math.max(0, inFlight - 1);
    },
  };

  const inferenceDeps = {
    workerPubKey: identity.publicKeyHex,
    defaultMaxTokens: config.MOCK_LLM_MAX_TOKENS,
    defaultTokenRateHz: config.MOCK_LLM_TOKEN_RATE_HZ,
    inFlightCounter,
  };

  const rpcHandle = await startRpcServer({
    identity,
    log,
    health: {
      workerId: config.WORKER_ID,
      workerPubKey: identity.publicKeyHex,
      capacity: config.WORKER_CAPACITY,
      inFlight: () => inFlight,
      startedAt,
      modelId: config.WORKER_MODEL_ID,
    },
    inference: inferenceDeps,
  });

  // Streaming inference travels over a Protomux channel attached to each
  // Hyperswarm connection (per `docs/architecture.md` §2.3).
  const streamServer = attachStreamChannelServer({
    swarm: swarmHandle.swarm,
    log,
    inference: inferenceDeps,
  });
  streamServer.start();

  log.info(
    {
      rpcPubKey: identity.publicKeyShort,
      methods: ['inference.run', 'worker.health', 'inference.stream'],
    },
    'rpc.ready',
  );

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, 'worker.shutdown.start');
    void (async () => {
      try {
        streamServer.stop();
        await rpcHandle.close();
        await swarmHandle.close();
        logEvent(log, WORKER_AUDIT_EVENT.workerLeft, {
          pubKey: identity.publicKeyShort,
          workerId: config.WORKER_ID,
        });
      } catch (err) {
        log.error({ err }, 'worker.shutdown.error');
      } finally {
        process.exit(0);
      }
    })();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Touch the runInference symbol so future static-analysis re-exports stay
  // satisfied even though the entrypoint itself doesn't call it directly.
  void runInference;
}

main().catch((err: unknown) => {
  // Best-effort log; falls back to stderr if the logger isn't built yet.
  process.stderr.write(
    `worker.fatal ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});
