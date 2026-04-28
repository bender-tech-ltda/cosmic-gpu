// P2P bootstrap orchestrator. Single entrypoint that opens the swarm,
// builds the RPC client + streaming transport + registry + dispatcher, and
// returns a `close()` for graceful shutdown (mirrors the state layer's
// `bootstrapState`).

import type { FastifyBaseLogger } from 'fastify';

import type { BackendConfig } from '../config/env.config.js';
import type { MetricsRegistry } from '../observability/metrics.js';
import type { CosmicState } from '../state/index.js';
import { InferenceDispatcher } from './dispatcher.js';
import { createRpcClient, type RpcClient } from './rpc-client.js';
import { WorkerRegistry } from './registry.js';
import { createProtomuxStreamTransport, type StreamTransport } from './stream-transport.js';
import { joinSwarm, type SwarmHandle } from './swarm.js';

export interface CosmicP2p {
  swarm: SwarmHandle;
  rpcClient: RpcClient;
  streamTransport: StreamTransport;
  registry: WorkerRegistry;
  dispatcher: InferenceDispatcher;
  close: () => Promise<void>;
}

export interface BootstrapP2pOptions {
  config: BackendConfig;
  state: CosmicState;
  log: FastifyBaseLogger;
  /** Optional metrics registry to forward dispatcher observations into. */
  metrics?: MetricsRegistry;
  /** Heartbeat poll cadence in ms (defaults to 10 s). */
  pollIntervalMs?: number;
}

export async function bootstrapP2p(opts: BootstrapP2pOptions): Promise<CosmicP2p> {
  const { config, state, log } = opts;
  const swarm = await joinSwarm(config, state.identity, log);
  // RPC client owns its own DHT (per `@hyperswarm/rpc` doc default). The
  // streaming transport keeps using the swarm's DHT because
  // `dht.connect()` does not register a keypair with the DHT — only
  // `dht.createServer().listen()` does — so the keypair-reuse rule
  // doesn't apply there.
  const rpcClient = createRpcClient({ identity: state.identity });
  const streamTransport = createProtomuxStreamTransport({
    identity: state.identity,
    dht: swarm.swarm.dht,
  });

  const registry = new WorkerRegistry({
    swarm: swarm.swarm,
    rpcClient,
    workersState: state.workers,
    log,
    pollIntervalMs: opts.pollIntervalMs ?? 10_000,
  });
  registry.start();

  const dispatcher = new InferenceDispatcher({
    rpcClient,
    streamTransport,
    workersState: state.workers,
    jobsState: state.jobs,
    log,
    ...(opts.metrics ? { metrics: opts.metrics } : {}),
  });

  if (opts.metrics) {
    opts.metrics.attachWorkerGauges(
      () => registry.size(),
      () => sumCapacities(state),
    );
  }

  log.info({ topic: '32B-base64', pubKey: state.identity.publicKeyShort }, 'p2p.ready');

  return {
    swarm,
    rpcClient,
    streamTransport,
    registry,
    dispatcher,
    close: async () => {
      await registry.stop();
      await rpcClient.close();
      await streamTransport.close();
      await swarm.close();
    },
  };
}

function sumCapacities(state: CosmicState): number {
  // Sync wrapper that intentionally swallows the async iterator's yield
  // sequence — metrics is best-effort and the caller doesn't `await`.
  let total = 0;
  void (async (): Promise<void> => {
    for await (const w of state.workers.list()) total += w.capacity;
  })();
  return total;
}

export { InferenceDispatcher } from './dispatcher.js';
export { WorkerRegistry } from './registry.js';
export type { RpcClient, RpcCodecs } from './rpc-client.js';
export type { StreamTransport } from './stream-transport.js';
