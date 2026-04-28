import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import type { BackendConfig } from '../config/env.config.js';

/**
 * Parse `FRONTEND_ORIGIN` as either a single value (legacy) or a
 * comma-separated allow-list. Each entry must be either an exact origin
 * (`http://localhost:5173`) or `*` to allow any.
 */
function parseOrigins(value: string): string | string[] {
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return '*';
  if (entries.length === 1) return entries[0] as string;
  return entries;
}

async function corsPlugin(app: FastifyInstance, opts: { config: BackendConfig }): Promise<void> {
  await app.register(cors, {
    origin: parseOrigins(opts.config.FRONTEND_ORIGIN),
    credentials: false,
  });
}

export default fp(corsPlugin, { name: 'cors' });
