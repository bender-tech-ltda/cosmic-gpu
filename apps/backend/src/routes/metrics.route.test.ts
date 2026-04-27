import { ERROR_CODE, type MetricsResponse, type UsageSummary } from '@cosmic/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

describe('GET /metrics', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the zeroed snapshot shape on a fresh registry', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as MetricsResponse;
    expect(body.inference.requests).toEqual({ success: 0, failed: 0, cancelled: 0 });
    expect(body.inference.tokens).toEqual({ prompt: 0, completion: 0 });
    expect(body.inference.latencyMs).toMatchObject({ count: 0 });
    expect(body.workers).toMatchObject({ connected: 0 });
    expect(body.rateLimit).toEqual({ rejections: 0 });
  });

  it('reflects observations recorded against app.metrics', async () => {
    app.metrics.recordRequest('success');
    app.metrics.recordRequest('success');
    app.metrics.recordRequest('failed');
    app.metrics.recordTokens('prompt', 4);
    app.metrics.recordTokens('completion', 6);
    app.metrics.recordLatencyMs(50);
    app.metrics.recordLatencyMs(150);
    app.metrics.recordRateLimitRejection();

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as MetricsResponse;
    expect(body.inference.requests).toEqual({ success: 2, failed: 1, cancelled: 0 });
    expect(body.inference.tokens).toEqual({ prompt: 4, completion: 6 });
    expect(body.inference.latencyMs.count).toBe(2);
    expect(body.inference.latencyMs.avg).toBe(100);
    expect(body.rateLimit.rejections).toBe(1);
  });

  it('is not subject to rate limiting', async () => {
    // Spam 5 calls in a row; none should 429 because the route opted out.
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'GET', url: '/metrics' });
      expect(res.statusCode).toBe(200);
    }
  });
});

describe('GET /v1/usage/me', () => {
  let app: FastifyInstance;
  let plaintext: string;
  let apiKeyId: string;

  beforeEach(async () => {
    app = await buildApp({ logger: false });
    const created = await app.apiKeys.create({ name: 'usage-fixture' });
    plaintext = created.plaintext;
    apiKeyId = created.record.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 ApiKeyMissing without an Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/usage/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: ERROR_CODE.apiKeyMissing });
  });

  it('aggregates per-window records into totals and a sorted windows[]', async () => {
    await app.state.usage.upsert({
      apiKeyId,
      windowStart: '2024-01-01T00:00:00.000Z',
      requests: 1,
      promptTokens: 2,
      completionTokens: 3,
    });
    await app.state.usage.upsert({
      apiKeyId,
      windowStart: '2024-01-01T00:01:00.000Z',
      requests: 4,
      promptTokens: 5,
      completionTokens: 6,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/usage/me',
      headers: { authorization: `Bearer ${plaintext}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as UsageSummary;
    expect(body.apiKeyId).toBe(apiKeyId);
    expect(body.totals).toEqual({ requests: 5, promptTokens: 7, completionTokens: 9 });
    expect(body.windows.map((w) => w.windowStart)).toEqual([
      '2024-01-01T00:01:00.000Z',
      '2024-01-01T00:00:00.000Z',
    ]);
  });

  it('returns an empty summary for a key with no usage yet', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/usage/me',
      headers: { authorization: `Bearer ${plaintext}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as UsageSummary;
    expect(body.totals).toEqual({ requests: 0, promptTokens: 0, completionTokens: 0 });
    expect(body.windows).toEqual([]);
  });
});
