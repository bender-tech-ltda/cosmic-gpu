import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import type { BackendConfig } from '../config/env.config.js';

async function corsPlugin(app: FastifyInstance, opts: { config: BackendConfig }): Promise<void> {
  await app.register(cors, {
    origin: opts.config.FRONTEND_ORIGIN,
    credentials: false,
  });
}

export default fp(corsPlugin, { name: 'cors' });
