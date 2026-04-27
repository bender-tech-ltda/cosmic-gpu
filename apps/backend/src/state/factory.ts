import type { BackendConfig } from '../config/env.config.js';
import { HyperbeeKvStore } from './hyperbee.adapter.js';
import { InMemoryKvStore } from './in-memory.adapter.js';
import type { KvStore } from './types.js';

/**
 * Pick a KvStore implementation based on `STATE_BACKEND`. Fails fast on
 * unknown values so misconfiguration surfaces at boot.
 */
export function createKvStore(config: BackendConfig): KvStore {
  switch (config.STATE_BACKEND) {
    case 'memory':
      return new InMemoryKvStore();
    case 'hyperbee':
      return new HyperbeeKvStore({ dataDir: config.DATA_DIR });
    default: {
      const exhaustiveCheck: never = config.STATE_BACKEND;
      throw new Error(`Unknown STATE_BACKEND: ${String(exhaustiveCheck)}`);
    }
  }
}
