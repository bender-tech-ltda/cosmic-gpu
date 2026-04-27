import { ERROR_CODE } from '@cosmic/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Type } from '@sinclair/typebox';

import { buildApp } from '../app.js';
import { DomainError } from '../errors/domain-error.js';

/**
 * We mount a couple of one-off routes onto a real app to exercise the
 * centralised error handler end-to-end.
 */
async function buildAppWithFixtures(): Promise<FastifyInstance> {
  const app = await buildApp({ logger: false });

  app.get('/__test/domain', async () => {
    throw new DomainError({
      statusCode: 404,
      code: ERROR_CODE.apiKeyNotFound,
      message: 'Test resource not found',
      details: { hint: 'fixture' },
    });
  });

  app.post(
    '/__test/validation',
    {
      schema: {
        body: Type.Object({ value: Type.Integer({ minimum: 0 }) }),
      },
    },
    async () => ({ ok: true }),
  );

  app.get('/__test/unknown', async () => {
    throw new Error('boom');
  });

  return app;
}

describe('error handler plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildAppWithFixtures();
  });

  afterAll(async () => {
    await app.close();
  });

  it('translates DomainError into the shared envelope', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/domain' });
    expect(res.statusCode).toBe(404);

    const body = res.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      statusCode: 404,
      code: ERROR_CODE.apiKeyNotFound,
      message: 'Test resource not found',
      details: { hint: 'fixture' },
    });
    expect(typeof body.requestId).toBe('string');
  });

  it('translates schema validation failures to ValidationFailed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/__test/validation',
      payload: { value: -1 },
    });
    expect(res.statusCode).toBe(400);

    const body = res.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      statusCode: 400,
      code: ERROR_CODE.validationFailed,
    });
    expect(body.details).toBeDefined();
    expect(typeof body.requestId).toBe('string');
  });

  it('hides unknown errors behind a generic 500', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/unknown' });
    expect(res.statusCode).toBe(500);

    const body = res.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      statusCode: 500,
      code: ERROR_CODE.internalError,
    });
    expect(body.message).not.toContain('boom');
    expect(typeof body.requestId).toBe('string');
  });
});
