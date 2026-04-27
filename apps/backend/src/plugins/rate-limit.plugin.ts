// Per-key rate limiting on top of `@fastify/rate-limit`.
// We bucket by the bearer token when present (so both authenticated and
// pre-auth requests share the same bucket per token) and fall back to the
// remote IP for anonymous traffic. Routes can opt out via
// `config: { rateLimit: false }`.

import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

function keyForRequest(req: FastifyRequest): string {
  const auth = req.headers.authorization;
  if (typeof auth === 'string') {
    const trimmed = auth.trim();
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      const token = trimmed.slice(7).trim();
      if (token.length > 0) return `key:${token}`;
    }
  }
  return `ip:${req.ip}`;
}

// Note: the 429 body is shaped by the central `errorHandlerPlugin` so it
// matches `ApiErrorBody`. The plugin itself only needs to bucket requests
// and trigger the error.
async function rateLimitPlugin(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: app.config.RATE_LIMIT_RPM,
    timeWindow: '1 minute',
    keyGenerator: keyForRequest,
  });
}

export default fp(rateLimitPlugin, { name: 'rate-limit', dependencies: ['auth'] });
