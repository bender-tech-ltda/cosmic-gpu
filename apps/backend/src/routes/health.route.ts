// Liveness endpoint. P2P fields are placeholders until Step 6 wires the
// real swarm peer count via a backend decorator.

import { HealthResponse, type HealthResponse as HealthResponseType } from '@cosmic/shared';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const VERSION = '0.1.0';

export const healthRoute: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Reports backend uptime, P2P connection status, and version.',
        response: { 200: HealthResponse },
      },
    },
    async (): Promise<HealthResponseType> => ({
      status: 'ok',
      uptimeSeconds: process.uptime(),
      p2p: { connected: false, peers: 0 },
      version: VERSION,
    }),
  );
};
