// `GET /metrics` \u2014 JSON snapshot of the in-memory `MetricsRegistry`.
//
// Public on the take-home (mirrors the deliberate trade-off documented for
// the public `/v1/api-keys` endpoints in `docs/architecture.md` \u00a74).
// Liveness scrapers must never be rate-limited.

import { MetricsResponse, type MetricsResponse as MetricsResponseType } from '@cosmic/shared';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

export const metricsRoute: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    '/metrics',
    {
      config: { rateLimit: false },
      schema: {
        tags: ['Telemetry'],
        summary: 'In-memory metrics snapshot',
        description:
          'Returns a JSON snapshot of inference counters, latency percentiles, worker pool size, and rate-limit rejections. Counters reset on restart (single-instance, in-memory \u2014 see `docs/architecture.md` \u00a74).',
        response: { 200: MetricsResponse },
      },
    },
    async (): Promise<MetricsResponseType> => app.metrics.snapshot(),
  );
};
