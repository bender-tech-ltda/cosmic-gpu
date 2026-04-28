// Liveness endpoint. P2P fields are sourced from the live worker registry
// when the P2P plugin is registered (production / dev). In tests where the
// plugin is skipped, the route falls back to the legacy placeholder so the
// HealthResponse shape stays stable.

import { HealthResponse, type HealthResponse as HealthResponseType } from '@cosmic/shared';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const VERSION = '0.1.0';

export const healthRoute: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    '/health',
    {
      // Liveness probes must never be rate-limited.
      config: { rateLimit: false },
      schema: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description:
          'Reports backend uptime, live P2P peer count, and version. Opt-out from rate limiting so health checks always succeed.',
        response: { 200: HealthResponse },
      },
    },
    async (): Promise<HealthResponseType> => {
      const peers = app.p2p?.registry.size() ?? 0;
      return {
        status: 'ok',
        uptimeSeconds: process.uptime(),
        p2p: { connected: peers > 0, peers },
        version: VERSION,
      };
    },
  );
};
