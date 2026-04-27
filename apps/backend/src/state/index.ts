// Single entrypoint that opens the KvStore, loads (or generates) identity,
// constructs every typed accessor, and exposes a `close()` for graceful
// shutdown.

import type { FastifyBaseLogger } from 'fastify';

import type { BackendConfig } from '../config/env.config.js';
import { ApiKeysState } from './api-keys.state.js';
import { createKvStore } from './factory.js';
import { createEphemeralIdentity, loadOrGenerateIdentity, type NodeIdentity } from './identity.js';
import { JobsState } from './jobs.state.js';
import type { KvStore } from './types.js';
import { UsageState } from './usage.state.js';
import { WorkersState } from './workers.state.js';

export interface CosmicState {
  kv: KvStore;
  identity: NodeIdentity;
  apiKeys: ApiKeysState;
  workers: WorkersState;
  jobs: JobsState;
  usage: UsageState;
  close(): Promise<void>;
}

export async function bootstrapState(
  config: BackendConfig,
  log: FastifyBaseLogger,
): Promise<CosmicState> {
  const kv = createKvStore(config);
  await kv.ready();

  const identity =
    config.STATE_BACKEND === 'memory'
      ? createEphemeralIdentity()
      : await loadOrGenerateIdentity(config.NODE_KEYPAIR_PATH);

  log.info(
    { pubKey: identity.publicKeyShort, backend: config.STATE_BACKEND },
    'state.bootstrapped',
  );

  return {
    kv,
    identity,
    apiKeys: new ApiKeysState(kv),
    workers: new WorkersState(kv),
    jobs: new JobsState(kv),
    usage: new UsageState(kv),
    async close() {
      await kv.close();
    },
  };
}

export * from './api-keys.state.js';
export * from './identity.js';
export * from './jobs.state.js';
export * from './types.js';
export * from './usage.state.js';
export * from './workers.state.js';
