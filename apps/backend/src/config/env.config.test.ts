import { describe, expect, it } from 'vitest';

import { loadConfig } from './env.config.js';

const baseEnv = {
  NODE_ENV: 'test',
  STATE_BACKEND: 'memory',
} as const;

describe('backend loadConfig', () => {
  it('accepts an empty discovery topic (falls back to dev default at swarm join)', () => {
    const config = loadConfig({ ...baseEnv, P2P_DISCOVERY_TOPIC: '' });
    expect(config.P2P_DISCOVERY_TOPIC).toBe('');
  });

  it('accepts a valid 32-byte base64 topic', () => {
    const topic = Buffer.alloc(32, 1).toString('base64');
    const config = loadConfig({ ...baseEnv, P2P_DISCOVERY_TOPIC: topic });
    expect(config.P2P_DISCOVERY_TOPIC).toBe(topic);
  });

  it('rejects the literal .env.example placeholder for the topic', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        P2P_DISCOVERY_TOPIC: 'replace-me-with-a-base64-encoded-32-byte-topic',
      }),
    ).toThrow(/still contains the .env.example placeholder/);
  });

  it('rejects a topic whose base64 decode is not 32 bytes', () => {
    const topic = Buffer.alloc(16).toString('base64');
    expect(() => loadConfig({ ...baseEnv, P2P_DISCOVERY_TOPIC: topic })).toThrow(
      /must be a base64-encoded 32-byte buffer; got 16 bytes/,
    );
  });

  it('requires a real HMAC secret when NODE_ENV=production', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        STATE_BACKEND: 'memory',
        API_KEY_HMAC_SECRET: '',
      }),
    ).toThrow(/API_KEY_HMAC_SECRET must be set/);
  });

  it('rejects the dev HMAC placeholder under production', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        STATE_BACKEND: 'memory',
        API_KEY_HMAC_SECRET: 'dev-only-replace-me',
      }),
    ).toThrow(/API_KEY_HMAC_SECRET must be set/);
  });

  it('accepts the dev HMAC placeholder under non-production', () => {
    const config = loadConfig({ ...baseEnv, API_KEY_HMAC_SECRET: 'dev-only-replace-me' });
    expect(config.API_KEY_HMAC_SECRET).toBe('dev-only-replace-me');
  });
});
