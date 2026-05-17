// Liveness + readiness endpoints. P2P fields are sourced from the live
// worker registry when the P2P plugin is registered (production / dev).
// In tests where the plugin is skipped, the route falls back to the
// legacy placeholder so the HealthResponse shape stays stable.

import {
  HealthResponse,
  ReadyResponse,
  type HealthResponse as HealthResponseType,
  type ReadyResponse as ReadyResponseType,
} from '@cosmic/shared';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const VERSION = '0.1.0';
const READY_PEER_THRESHOLD = 1;

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

  app.get(
    '/ready',
    {
      config: { rateLimit: false },
      schema: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description:
          'Returns 200 only when the backend has at least one registered worker (the dispatcher can serve traffic). Returns 503 with `reason: "no_peers"` during the cold-start window before the swarm forms. Opt-out from rate limiting so orchestrator probes always succeed.',
        response: {
          200: ReadyResponse,
          503: ReadyResponse,
        },
      },
    },
    async (_request, reply): Promise<ReadyResponseType> => {
      const peers = app.p2p?.registry.size() ?? 0;
      if (peers >= READY_PEER_THRESHOLD) {
        return { status: 'ready', peers };
      }
      reply.code(503);
      return { status: 'not_ready', peers, reason: 'no_peers' };
    },
  );
};
