// Decorates `app.metrics` with the in-memory `MetricsRegistry`. Registered
// before any plugin that records into it (rate-limit error path, P2P
// dispatcher) so the registry is available wherever `app.metrics` is
// consumed.

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { MetricsRegistry } from '../observability/metrics.js';

declare module 'fastify' {
  interface FastifyInstance {
    metrics: MetricsRegistry;
  }
}

async function metricsPlugin(app: FastifyInstance): Promise<void> {
  app.decorate('metrics', new MetricsRegistry());
}

export default fp(metricsPlugin, { name: 'metrics' });
