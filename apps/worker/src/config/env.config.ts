// Strongly-typed environment loader for the worker.
// Validates every variable and fails fast at boot when required ones are
// missing or malformed.

import { cleanEnv, num, str } from 'envalid';

export interface WorkerConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  WORKER_ID: string;
  WORKER_LOG_LEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  /** Soft-removal threshold for unhealthy workers, in milliseconds. */
  WORKER_HEARTBEAT_INTERVAL_MS: number;
  /** Maximum concurrent inference jobs the worker advertises. */
  WORKER_CAPACITY: number;
  /** Model id served by this worker. */
  WORKER_MODEL_ID: string;
  /**
   * Comma-separated list of `host:port` HyperDHT bootstrap nodes. Empty (the
   * default) means "use the public Holepunch DHT". Set this for
   * self-contained Compose runs.
   */
  P2P_BOOTSTRAP: string;
  /** Base64-encoded 32-byte topic shared by every node in the swarm. */
  P2P_DISCOVERY_TOPIC: string;
  /** On-disk path to the persisted ed25519 SEED. Keypair is derived. */
  NODE_KEYPAIR_PATH: string;
  /** Local data directory. Used as a default for `NODE_KEYPAIR_PATH`. */
  DATA_DIR: string;
  /** Synthetic token-stream rate, in Hz. */
  MOCK_LLM_TOKEN_RATE_HZ: number;
  /** Hard cap on synthetic tokens generated per inference job. */
  MOCK_LLM_MAX_TOKENS: number;
}

/**
 * Reads + validates `process.env` and returns a typed config object.
 * Tests can inject a partial map by passing a custom env source.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const cleaned = cleanEnv(env, {
    NODE_ENV: str({
      choices: ['development', 'production', 'test'],
      default: 'development',
    }),
    WORKER_ID: str({ default: 'worker-local' }),
    WORKER_LOG_LEVEL: str({
      choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
      default: 'info',
    }),
    WORKER_HEARTBEAT_INTERVAL_MS: num({ default: 10_000 }),
    WORKER_CAPACITY: num({ default: 4 }),
    WORKER_MODEL_ID: str({ default: 'mock-llm' }),
    P2P_BOOTSTRAP: str({ default: '' }),
    P2P_DISCOVERY_TOPIC: str({ default: '' }),
    NODE_KEYPAIR_PATH: str({ default: './data/worker.keypair' }),
    DATA_DIR: str({ default: './data' }),
    MOCK_LLM_TOKEN_RATE_HZ: num({ default: 25 }),
    MOCK_LLM_MAX_TOKENS: num({ default: 64 }),
  });

  return {
    NODE_ENV: cleaned.NODE_ENV,
    WORKER_ID: cleaned.WORKER_ID,
    WORKER_LOG_LEVEL: cleaned.WORKER_LOG_LEVEL,
    WORKER_HEARTBEAT_INTERVAL_MS: cleaned.WORKER_HEARTBEAT_INTERVAL_MS,
    WORKER_CAPACITY: cleaned.WORKER_CAPACITY,
    WORKER_MODEL_ID: cleaned.WORKER_MODEL_ID,
    P2P_BOOTSTRAP: cleaned.P2P_BOOTSTRAP,
    P2P_DISCOVERY_TOPIC: cleaned.P2P_DISCOVERY_TOPIC,
    NODE_KEYPAIR_PATH: cleaned.NODE_KEYPAIR_PATH,
    DATA_DIR: cleaned.DATA_DIR,
    MOCK_LLM_TOKEN_RATE_HZ: cleaned.MOCK_LLM_TOKEN_RATE_HZ,
    MOCK_LLM_MAX_TOKENS: cleaned.MOCK_LLM_MAX_TOKENS,
  };
}
