// JSON `/metrics` envelope. Mirrors the backend's `MetricsRegistry.snapshot()`
// so the frontend dashboard can consume it verbatim. Counters reset on
// restart \u2014 documented in `docs/architecture.md` \u00a74.

import { Type, type Static } from '@sinclair/typebox';

export const MetricsRequestsCounters = Type.Object({
  success: Type.Integer({ minimum: 0 }),
  failed: Type.Integer({ minimum: 0 }),
  cancelled: Type.Integer({ minimum: 0 }),
});

export const MetricsTokensCounters = Type.Object({
  prompt: Type.Integer({ minimum: 0 }),
  completion: Type.Integer({ minimum: 0 }),
});

export const MetricsLatency = Type.Object({
  count: Type.Integer({ minimum: 0, description: 'Number of samples in the rolling window.' }),
  avg: Type.Number({ minimum: 0 }),
  p50: Type.Number({ minimum: 0 }),
  p95: Type.Number({ minimum: 0 }),
  p99: Type.Number({ minimum: 0 }),
});

export const MetricsResponse = Type.Object({
  inference: Type.Object({
    requests: MetricsRequestsCounters,
    tokens: MetricsTokensCounters,
    latencyMs: MetricsLatency,
  }),
  workers: Type.Object({
    connected: Type.Integer({ minimum: 0 }),
    capacity: Type.Integer({ minimum: 0 }),
  }),
  rateLimit: Type.Object({
    rejections: Type.Integer({ minimum: 0 }),
  }),
});
export type MetricsResponse = Static<typeof MetricsResponse>;
