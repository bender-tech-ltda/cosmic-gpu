// P2P bootstrap orchestrator. Single entrypoint that opens the swarm,
// builds the RPC client + streaming transport + registry + dispatcher, and
// returns a `close()` for graceful shutdown (mirrors the state layer's
// `bootstrapState`).

import type { FastifyBaseLogger } from 'fastify';

import type { BackendConfig } from '../config/env.config.js';
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
  /** Heartbeat poll cadence in ms (defaults to 10 s). */
  pollIntervalMs?: number;
}

export async function bootstrapP2p(opts: BootstrapP2pOptions): Promise<CosmicP2p> {
  const { config, state, log } = opts;
  const swarm = await joinSwarm(config, state.identity, log);
  const rpcClient = createRpcClient({ identity: state.identity, dht: swarm.swarm.dht });
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
  });

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

export { InferenceDispatcher } from './dispatcher.js';
export { WorkerRegistry } from './registry.js';
export type { RpcClient, RpcCodecs } from './rpc-client.js';
export type { StreamTransport } from './stream-transport.js';
