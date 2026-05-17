import { describe, expect, it } from 'vitest';

import { loadConfig } from './env.config.js';

describe('worker loadConfig', () => {
  it('accepts an empty discovery topic', () => {
    const config = loadConfig({ NODE_ENV: 'test', P2P_DISCOVERY_TOPIC: '' });
    expect(config.P2P_DISCOVERY_TOPIC).toBe('');
  });

  it('accepts a valid 32-byte base64 topic', () => {
    const topic = Buffer.alloc(32, 7).toString('base64');
    const config = loadConfig({ NODE_ENV: 'test', P2P_DISCOVERY_TOPIC: topic });
    expect(config.P2P_DISCOVERY_TOPIC).toBe(topic);
  });

  it('rejects the literal .env.example placeholder', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        P2P_DISCOVERY_TOPIC: 'replace-me-with-a-base64-encoded-32-byte-topic',
      }),
    ).toThrow(/still contains the .env.example placeholder/);
  });

  it('rejects a topic whose base64 decode is not 32 bytes', () => {
    const topic = Buffer.alloc(64).toString('base64');
    expect(() => loadConfig({ NODE_ENV: 'test', P2P_DISCOVERY_TOPIC: topic })).toThrow(
      /got 64 bytes/,
    );
  });
});
