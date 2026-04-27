import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * CSP is intentionally disabled here because Swagger UI inlines scripts and
 * styles. For a production deployment we would either scope CSP to non-`/docs`
 * routes or build a strict allowlist. Documented as a future improvement in
 * `docs/architecture.md`.
 */
async function helmetPlugin(app: FastifyInstance): Promise<void> {
  await app.register(helmet, { contentSecurityPolicy: false });
}

export default fp(helmetPlugin, { name: 'helmet' });
