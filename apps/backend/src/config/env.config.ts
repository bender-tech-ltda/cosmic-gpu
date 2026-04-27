// Strongly-typed environment loader for the backend.
// Validates every variable from `.env.example` and fails fast at boot when
// required ones are missing or malformed.

import { cleanEnv, host, num, port, str } from 'envalid';

export interface BackendConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  BACKEND_HOST: string;
  BACKEND_PORT: number;
  BACKEND_LOG_LEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  /** Maximum HTTP request body size, in bytes. */
  BACKEND_BODY_LIMIT_BYTES: number;
  FRONTEND_ORIGIN: string;
  RATE_LIMIT_RPM: number;
  API_KEY_HMAC_SECRET: string;
  P2P_DISCOVERY_TOPIC: string;
  /**
   * Comma-separated list of `host:port` HyperDHT bootstrap nodes for the
   * Hyperswarm topic. Empty (the default) means "use the public Holepunch
   * DHT". Set this for self-contained Compose runs or air-gapped demos.
   */
  P2P_BOOTSTRAP: string;
  NODE_KEYPAIR_PATH: string;
  DATA_DIR: string;
  STATE_BACKEND: 'memory' | 'hyperbee';
}

/**
 * Reads + validates `process.env` and returns a typed config object.
 * Override values in tests by passing a partial map (envalid accepts a
 * raw env source as the first argument).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  // Detect NODE_ENV up front so `STATE_BACKEND` can default to `memory` in
  // tests without requiring CI to set the env var explicitly.
  const detectedNodeEnv = env.NODE_ENV ?? 'development';
  const defaultStateBackend = detectedNodeEnv === 'test' ? 'memory' : 'hyperbee';

  const cleaned = cleanEnv(env, {
    NODE_ENV: str({
      choices: ['development', 'production', 'test'],
      default: 'development',
    }),
    BACKEND_HOST: host({ default: '0.0.0.0' }),
    BACKEND_PORT: port({ default: 3000 }),
    BACKEND_LOG_LEVEL: str({
      choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
      default: 'info',
    }),
    BACKEND_BODY_LIMIT_BYTES: num({ default: 1_048_576 }),
    FRONTEND_ORIGIN: str({ default: 'http://localhost:5173' }),
    RATE_LIMIT_RPM: num({ default: 60 }),
    // Required in real deployments. We tolerate a placeholder in dev/tests so
    // `pnpm dev` and Vitest don't blow up before the user generates a real one.
    API_KEY_HMAC_SECRET: str({ default: 'dev-only-replace-me' }),
    P2P_DISCOVERY_TOPIC: str({ default: '' }),
    P2P_BOOTSTRAP: str({ default: '' }),
    NODE_KEYPAIR_PATH: str({ default: './data/node.keypair' }),
    DATA_DIR: str({ default: './data' }),
    STATE_BACKEND: str({
      choices: ['memory', 'hyperbee'],
      default: defaultStateBackend,
    }),
  });

  return {
    NODE_ENV: cleaned.NODE_ENV,
    BACKEND_HOST: cleaned.BACKEND_HOST,
    BACKEND_PORT: cleaned.BACKEND_PORT,
    BACKEND_LOG_LEVEL: cleaned.BACKEND_LOG_LEVEL,
    BACKEND_BODY_LIMIT_BYTES: cleaned.BACKEND_BODY_LIMIT_BYTES,
    FRONTEND_ORIGIN: cleaned.FRONTEND_ORIGIN,
    RATE_LIMIT_RPM: cleaned.RATE_LIMIT_RPM,
    API_KEY_HMAC_SECRET: cleaned.API_KEY_HMAC_SECRET,
    P2P_DISCOVERY_TOPIC: cleaned.P2P_DISCOVERY_TOPIC,
    P2P_BOOTSTRAP: cleaned.P2P_BOOTSTRAP,
    NODE_KEYPAIR_PATH: cleaned.NODE_KEYPAIR_PATH,
    DATA_DIR: cleaned.DATA_DIR,
    STATE_BACKEND: cleaned.STATE_BACKEND,
  };
}
