// Hyperswarm join helper for the backend.
//
// Mirrors `apps/worker/src/runtime/swarm.ts`. The backend joins the same
// 32-byte topic the workers do, so it can discover them via
// `swarm.on('connection')` and address them by their public keys via
// `@hyperswarm/rpc`.

import { DEFAULT_DISCOVERY_TOPIC, decodeDiscoveryTopic } from '@cosmic/shared';
import Hyperswarm, { type HyperswarmDiscovery } from 'hyperswarm';
import type { FastifyBaseLogger } from 'fastify';

import type { BackendConfig } from '../config/env.config.js';
import type { NodeIdentity } from '../state/identity.js';

export interface SwarmHandle {
  swarm: Hyperswarm;
  discovery: HyperswarmDiscovery;
  topic: Uint8Array;
  close: () => Promise<void>;
}

function parseBootstrap(value: string): Array<{ host: string; port: number }> | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, portRaw] = entry.split(':');
      const port = Number.parseInt(portRaw ?? '', 10);
      if (!host || !Number.isFinite(port) || port <= 0) {
        throw new Error(`P2P_BOOTSTRAP entry is not host:port — got "${entry}"`);
      }
      return { host, port };
    });
}

function resolveTopic(config: BackendConfig, log: FastifyBaseLogger): Uint8Array {
  if (config.P2P_DISCOVERY_TOPIC.length > 0) {
    return decodeDiscoveryTopic(config.P2P_DISCOVERY_TOPIC);
  }
  log.warn(
    { fallback: 'DEFAULT_DISCOVERY_TOPIC' },
    'P2P_DISCOVERY_TOPIC is empty — using built-in dev topic. Set this in production.',
  );
  return DEFAULT_DISCOVERY_TOPIC;
}

export async function joinSwarm(
  config: BackendConfig,
  identity: NodeIdentity,
  log: FastifyBaseLogger,
): Promise<SwarmHandle> {
  const topic = resolveTopic(config, log);
  const bootstrap = parseBootstrap(config.P2P_BOOTSTRAP);

  const swarm = new Hyperswarm({
    keyPair: { publicKey: identity.publicKey, secretKey: identity.secretKey },
    ...(bootstrap !== undefined ? { bootstrap } : {}),
  });

  const discovery = swarm.join(topic, { client: true, server: true });
  await discovery.flushed();

  return {
    swarm,
    discovery,
    topic,
    close: async () => {
      try {
        await swarm.leave(topic);
      } catch {
        /* swallow on shutdown */
      }
      await swarm.destroy();
    },
  };
}
