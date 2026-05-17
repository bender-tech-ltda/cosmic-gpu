import { REQUEST_ID_HEADER } from '@cosmic/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 and the expected shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);

    const body = res.json() as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(body.p2p).toMatchObject({ connected: false, peers: 0 });
    expect(typeof body.version).toBe('string');
  });

  it('echoes the supplied x-request-id header back', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { [REQUEST_ID_HEADER]: 'test-req-1' },
    });
    expect(res.headers[REQUEST_ID_HEADER]).toBe('test-req-1');
  });

  it('generates an x-request-id when none is supplied', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    const id = res.headers[REQUEST_ID_HEADER];
    expect(typeof id).toBe('string');
    expect((id as string).length).toBeGreaterThan(0);
  });
});

describe('GET /ready', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 503 not_ready when no peers are registered (test mode skips P2P)', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'not_ready', peers: 0, reason: 'no_peers' });
  });
});
