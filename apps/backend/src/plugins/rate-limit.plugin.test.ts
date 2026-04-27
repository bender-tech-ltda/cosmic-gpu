import { ERROR_CODE } from '@cosmic/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';
import { loadConfig } from '../config/env.config.js';

describe('rate-limit plugin', () => {
  let app: FastifyInstance;
  let plaintextA: string;
  let plaintextB: string;

  beforeAll(async () => {
    const config = loadConfig({
      ...process.env,
      NODE_ENV: 'test',
      RATE_LIMIT_RPM: '2',
    });
    app = await buildApp({ logger: false, config });
    app.get('/__test/limited', { preHandler: app.authenticate }, async () => ({ ok: true }));
    await app.ready();
    plaintextA = (await app.apiKeys.create({ name: 'a' })).plaintext;
    plaintextB = (await app.apiKeys.create({ name: 'b' })).plaintext;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 with shared envelope after exceeding the limit', async () => {
    for (let i = 0; i < 2; i++) {
      const ok = await app.inject({
        method: 'GET',
        url: '/__test/limited',
        headers: { authorization: `Bearer ${plaintextA}` },
      });
      expect(ok.statusCode).toBe(200);
    }
    const blocked = await app.inject({
      method: 'GET',
      url: '/__test/limited',
      headers: { authorization: `Bearer ${plaintextA}` },
    });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.json()).toMatchObject({
      statusCode: 429,
      code: ERROR_CODE.rateLimited,
    });
  });

  it('isolates limits per bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/__test/limited',
      headers: { authorization: `Bearer ${plaintextB}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('does not rate-limit /health', async () => {
    // Two prior requests already exhausted plaintextA's key budget; /health
    // is opted out so it still returns 200 regardless.
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    }
  });
});
