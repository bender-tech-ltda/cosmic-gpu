// Fastify application factory. Tests use `app.inject(...)` against the
// instance returned here without binding to a port. `server.ts` wraps this
// with `app.listen(...)`.

import { REQUEST_ID_HEADER } from '@cosmic/shared';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';

import { loadConfig, type BackendConfig } from './config/env.config.js';
import authPlugin from './plugins/auth.plugin.js';
import corsPlugin from './plugins/cors.plugin.js';
import errorHandlerPlugin from './plugins/error-handler.plugin.js';
import helmetPlugin from './plugins/helmet.plugin.js';
import rateLimitPlugin from './plugins/rate-limit.plugin.js';
import requestIdPlugin from './plugins/request-id.plugin.js';
import statePlugin from './plugins/state.plugin.js';
import swaggerPlugin from './plugins/swagger.plugin.js';
import { apiKeysRoute } from './routes/api-keys.route.js';
import { healthRoute } from './routes/health.route.js';
import { modelsRoute } from './routes/models.route.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Validated, typed configuration. */
    config: BackendConfig;
  }
}

export interface BuildAppOptions {
  /** Override env-var-derived configuration. Useful in tests. */
  config?: BackendConfig;
  /** Override Fastify logger settings. Tests usually pass `false`. */
  logger?: boolean | object;
}

/**
 * Build a configured Fastify instance. Does NOT call `app.listen()`.
 * The caller (server.ts or a test) decides what to do with the instance.
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();

  // Pino redaction paths: never let secrets, prompts, or one-time plaintext
  // tokens land in the structured logs. Pino accepts wildcard `[*]` segments
  // and the censor string is always emitted in place of the value.
  const redactPaths: string[] = [
    'req.headers.authorization',
    'res.headers.authorization',
    'request.headers.authorization',
    'headers.authorization',
    'authorization',
    'plaintext',
    'apiKey.plaintext',
    'req.body.messages[*].content',
    'request.body.messages[*].content',
    'body.messages[*].content',
  ];

  const baseLoggerOpts =
    config.NODE_ENV === 'development'
      ? {
          level: config.BACKEND_LOG_LEVEL,
          transport: { target: 'pino-pretty', options: { translateTime: 'SYS:standard' } },
          redact: { paths: redactPaths, censor: '[REDACTED]' },
        }
      : {
          level: config.BACKEND_LOG_LEVEL,
          redact: { paths: redactPaths, censor: '[REDACTED]' },
        };

  const app = Fastify({
    logger: options.logger ?? baseLoggerOpts,
    bodyLimit: config.BACKEND_BODY_LIMIT_BYTES,
    genReqId: (req) => {
      const fromHeader = req.headers[REQUEST_ID_HEADER];
      if (typeof fromHeader === 'string' && fromHeader.length > 0) return fromHeader;
      return randomUUID();
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.decorate('config', config);
  app.log.child({ service: 'backend' });

  // Cross-cutting plugins (order matters for some).
  await app.register(helmetPlugin);
  await app.register(corsPlugin, { config });
  await app.register(swaggerPlugin);
  await app.register(requestIdPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(statePlugin);
  await app.register(authPlugin);
  await app.register(rateLimitPlugin);

  // Routes.
  await app.register(healthRoute);
  await app.register(modelsRoute, { prefix: '/v1' });
  await app.register(apiKeysRoute, { prefix: '/v1' });

  return app;
}
