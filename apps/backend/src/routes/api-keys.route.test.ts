import { ERROR_CODE } from '@cosmic/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

describe('api-keys routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/api-keys returns 201 with plaintext exactly once', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/api-keys',
      payload: { name: 'cli' },
    });
    expect(res.statusCode).toBe(201);

    const body = res.json() as Record<string, unknown>;
    expect(typeof body.plaintext).toBe('string');
    expect((body.plaintext as string).startsWith('sk-')).toBe(true);
    expect(typeof body.id).toBe('string');
    expect(body.scopes).toEqual(['inference:read']);
    expect(body.revokedAt).toBeNull();
    expect(typeof body.prefix).toBe('string');
  });

  it('GET /v1/api-keys returns the public-safe list (no plaintext / hash)', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/api-keys' });
    expect(res.statusCode).toBe(200);

    const body = res.json() as { data: Record<string, unknown>[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    for (const item of body.data) {
      expect(item.plaintext).toBeUndefined();
      expect(item.keyHash).toBeUndefined();
      expect(typeof item.prefix).toBe('string');
    }
  });

  it('DELETE /v1/api-keys/:id returns 204 on success', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/api-keys',
      payload: { name: 'to-delete' },
    });
    const { id } = created.json() as { id: string };

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/api-keys/${id}`,
    });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
  });

  it('DELETE on an unknown id returns 404 with apiKeyNotFound', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/api-keys/ak_does_not_exist',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({
      statusCode: 404,
      code: ERROR_CODE.apiKeyNotFound,
    });
  });
});
