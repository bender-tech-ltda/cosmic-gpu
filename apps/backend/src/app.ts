// Fastify application factory. Tests use `app.inject(...)` against the
// instance returned here without binding to a port. `server.ts` wraps this
// with `app.listen(...)`.

import { REQUEST_ID_HEADER } from '@cosmic/shared';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';

import { loadConfig, type BackendConfig } from './config/env.config.js';
import corsPlugin from './plugins/cors.plugin.js';
import errorHandlerPlugin from './plugins/error-handler.plugin.js';
import helmetPlugin from './plugins/helmet.plugin.js';
import requestIdPlugin from './plugins/request-id.plugin.js';
import statePlugin from './plugins/state.plugin.js';
import swaggerPlugin from './plugins/swagger.plugin.js';
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

  const app = Fastify({
    logger:
      options.logger ??
      (config.NODE_ENV === 'development'
        ? {
            level: config.BACKEND_LOG_LEVEL,
            transport: { target: 'pino-pretty', options: { translateTime: 'SYS:standard' } },
          }
        : { level: config.BACKEND_LOG_LEVEL }),
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

  // Routes.
  await app.register(healthRoute);
  await app.register(modelsRoute, { prefix: '/v1' });

  return app;
}
