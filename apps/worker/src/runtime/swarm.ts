// Hyperswarm join helper.
//
// Constructs a `Hyperswarm` instance using the persisted ed25519 keypair, so
// the worker's pubkey is stable across restarts. Optional `P2P_BOOTSTRAP`
// (`host:port[,host:port...]`) overrides the public Holepunch DHT for
// self-contained Compose / air-gapped runs.

import Hyperswarm, { type HyperswarmDiscovery } from 'hyperswarm';
import type { Logger } from 'pino';

import { DEFAULT_DISCOVERY_TOPIC, decodeDiscoveryTopic } from '@cosmic/shared';

import type { WorkerConfig } from '../config/env.config.js';
import { parseBootstrap } from './bootstrap.js';
import type { WorkerIdentity } from './identity.js';

export interface SwarmHandle {
  swarm: Hyperswarm;
  discovery: HyperswarmDiscovery;
  topic: Uint8Array;
  close: () => Promise<void>;
}

function resolveTopic(config: WorkerConfig, log: Logger): Uint8Array {
  if (config.P2P_DISCOVERY_TOPIC.length > 0) {
    return decodeDiscoveryTopic(config.P2P_DISCOVERY_TOPIC);
  }
  log.warn(
    { fallback: 'DEFAULT_DISCOVERY_TOPIC' },
    'P2P_DISCOVERY_TOPIC is empty — using built-in dev topic. Set this in production.',
  );
  return DEFAULT_DISCOVERY_TOPIC;
}

/**
 * Build a Hyperswarm instance, join the configured topic, and return a
 * handle exposing the swarm + a `close()` for graceful shutdown.
 */
export async function joinSwarm(
  config: WorkerConfig,
  identity: WorkerIdentity,
  log: Logger,
): Promise<SwarmHandle> {
  const topic = resolveTopic(config, log);
  const bootstrap = parseBootstrap(config.P2P_BOOTSTRAP);

  const swarm = new Hyperswarm({
    keyPair: { publicKey: identity.publicKey, secretKey: identity.secretKey },
    ...(bootstrap !== undefined ? { bootstrap } : {}),
  });

  // Catch swarm-level failures (DHT errors, listener exceptions) so they
  // don't terminate the process via the EventEmitter `'error'` contract.
  swarm.on('error', (err: unknown) => {
    log.warn({ err }, 'hyperswarm.swarm_error');
  });

  // Every incoming peer is a NoiseSecretStream. Attach a defensive `'error'`
  // listener BEFORE the stream-channel server does so a stranger resetting
  // the connection mid-handshake doesn't crash the worker. The stream
  // destroys itself on error; consumers observe it via their close hooks.
  swarm.on('connection', (conn: unknown) => {
    const emitter = conn as { on?: (event: 'error', cb: (err: unknown) => void) => void };
    if (typeof emitter.on === 'function') {
      emitter.on('error', (err: unknown) => {
        log.warn({ err }, 'hyperswarm.connection_error');
      });
    }
  });

  // Worker uses swarm as a *client* only — the canonical listener for this
  // pubkey lives on the RPC server's own DHT (`runtime/rpc-server.ts`), which
  // is registered via `rpc.createServer().listen(keyPair)`. If we ALSO did
  // `swarm.join(topic, { server: true })` here, the same pubkey would be
  // advertised twice on the shared bootstrap (once by swarm.dht, once by
  // rpc.dht). Backend `dht.connect(workerPubKey)` lookups would round-robin
  // between the two listeners; whichever resolves first wins. The swarm
  // listener accepts a raw NoiseSecretStream that has no Protomux RPC
  // handlers — RPC framing then fails with `CHANNEL_CLOSED` /
  // `CHANNEL_DESTROYED`, producing the soft-removal loop reviewers saw.
  //
  // With client-only here, the swarm still discovers the backend (which IS a
  // server) so the backend's `swarm.on('connection')` fires on first contact;
  // the backend then learns this worker's pubkey from `conn.remotePublicKey`
  // and points its RPC client at the single canonical listener.
  const discovery = swarm.join(topic, { client: true, server: false });
  await discovery.flushed();

  return {
    swarm,
    discovery,
    topic,
    close: async () => {
      try {
        await swarm.leave(topic);
      } catch {
        /* swallow — we're tearing down anyway */
      }
      await swarm.destroy();
    },
  };
}
