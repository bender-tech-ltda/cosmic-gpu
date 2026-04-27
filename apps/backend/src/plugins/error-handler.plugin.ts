// Centralised Fastify error handler.
// Maps every thrown error into the shared `ApiErrorBody` envelope so the
// frontend can pattern-match on `code`.

import { ERROR_CODE, type ApiErrorBody } from '@cosmic/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { isDomainError } from '../errors/domain-error.js';

async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    // Domain errors carry their own status + code.
    if (isDomainError(error)) {
      const body: ApiErrorBody = {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        requestId: request.id,
        ...(error.details !== undefined ? { details: error.details } : {}),
      };
      request.log.warn(
        { err: error, code: error.code, statusCode: error.statusCode },
        'domain error',
      );
      return reply.code(error.statusCode).send(body);
    }

    // Fastify schema validation failures.
    if (error.validation && error.statusCode === 400) {
      const body: ApiErrorBody = {
        statusCode: 400,
        code: ERROR_CODE.validationFailed,
        message: error.message,
        requestId: request.id,
        details: error.validation,
      };
      request.log.warn({ err: error, validation: error.validation }, 'validation error');
      return reply.code(400).send(body);
    }

    // `@fastify/rate-limit` signals exhaustion by throwing an error with
    // `statusCode: 429`. Translate it into the shared envelope so clients
    // get a consistent shape and our `code` field stays meaningful.
    if (error.statusCode === 429) {
      const body: ApiErrorBody = {
        statusCode: 429,
        code: ERROR_CODE.rateLimited,
        message: error.message || 'Rate limit exceeded.',
        requestId: request.id,
      };
      request.log.warn({ err: error }, 'rate limited');
      return reply.code(429).send(body);
    }

    // Anything else: log full error, expose generic message.
    request.log.error({ err: error }, 'unhandled error');
    const body: ApiErrorBody = {
      statusCode: 500,
      code: ERROR_CODE.internalError,
      message: 'An unexpected error occurred.',
      requestId: request.id,
    };
    return reply.code(500).send(body);
  });
}

export default fp(errorHandlerPlugin, { name: 'error-handler' });
