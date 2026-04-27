import { ERROR_CODE } from '@cosmic/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

describe('auth plugin', () => {
  let app: FastifyInstance;
  let plaintext: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    app.get(
      '/__test/protected',
      {
        config: { rateLimit: false },
        preHandler: app.authenticate,
      },
      async (req) => ({ apiKey: req.apiKey }),
    );
    await app.ready();
    const created = await app.apiKeys.create({ name: 'fixture' });
    plaintext = created.plaintext;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 apiKeyMissing when the Authorization header is absent', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/protected' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      statusCode: 401,
      code: ERROR_CODE.apiKeyMissing,
    });
  });

  it('returns 401 apiKeyInvalid for the wrong auth scheme', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      headers: { authorization: 'Basic foo' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: ERROR_CODE.apiKeyInvalid });
  });

  it('returns 401 apiKeyInvalid for an unknown bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      headers: { authorization: 'Bearer sk-not-a-real-key' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: ERROR_CODE.apiKeyInvalid });
  });

  it('decorates request.apiKey when authentication succeeds', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      headers: { authorization: `Bearer ${plaintext}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { apiKey: Record<string, unknown> };
    expect(body.apiKey.name).toBe('fixture');
    expect(typeof body.apiKey.id).toBe('string');
    expect((body.apiKey.prefix as string).startsWith('sk-')).toBe(true);
  });

  it('returns 403 apiKeyRevoked for a revoked key', async () => {
    const created = await app.apiKeys.create({ name: 'to-revoke' });
    await app.apiKeys.revoke(created.record.id);
    const res = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      headers: { authorization: `Bearer ${created.plaintext}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: ERROR_CODE.apiKeyRevoked });
  });
});
