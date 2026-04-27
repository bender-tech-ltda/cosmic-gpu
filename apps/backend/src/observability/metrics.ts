// In-memory metrics registry.
//
// We deliberately keep this lightweight (no `prom-client`) so the take-home
// stays small. The shape returned by `snapshot()` is exposed verbatim by
// `GET /metrics` and consumed by the frontend dashboard in Step 10.
// Counters reset on restart \u2014 same trade-off as the in-memory rate-limit
// store; it's documented in `docs/architecture.md` \u00a74.
//
// Latency is tracked via a fixed-size ring buffer of recent samples (default
// 1000). Percentiles are computed lazily in `snapshot()` so the hot
// `record*` paths stay allocation-free.

export type InferenceOutcome = 'success' | 'failed' | 'cancelled';
export type TokenDirection = 'prompt' | 'completion';

export interface MetricsSnapshot {
  inference: {
    requests: { success: number; failed: number; cancelled: number };
    tokens: { prompt: number; completion: number };
    latencyMs: { count: number; avg: number; p50: number; p95: number; p99: number };
  };
  workers: { connected: number; capacity: number };
  rateLimit: { rejections: number };
}

export interface MetricsRegistryOptions {
  /** Max number of latency samples kept in the ring buffer. */
  bufferSize?: number;
  /** Live worker counts. Both default to `() => 0` if not provided. */
  workersConnected?: () => number;
  workersCapacity?: () => number;
}

export class MetricsRegistry {
  private readonly latency: number[];
  private latencyCount = 0;
  private latencyHead = 0;
  private readonly bufferSize: number;
  private readonly counts = {
    success: 0,
    failed: 0,
    cancelled: 0,
    promptTokens: 0,
    completionTokens: 0,
    rateLimitRejections: 0,
  };
  private workersConnected: () => number;
  private workersCapacity: () => number;

  constructor(opts: MetricsRegistryOptions = {}) {
    this.bufferSize = Math.max(1, opts.bufferSize ?? 1000);
    this.latency = new Array<number>(this.bufferSize);
    this.workersConnected = opts.workersConnected ?? ((): number => 0);
    this.workersCapacity = opts.workersCapacity ?? ((): number => 0);
  }

  /** Late-bind the worker gauges once the P2P plugin has built the registry. */
  attachWorkerGauges(connected: () => number, capacity: () => number): void {
    this.workersConnected = connected;
    this.workersCapacity = capacity;
  }

  recordRequest(outcome: InferenceOutcome): void {
    this.counts[outcome] += 1;
  }

  recordTokens(direction: TokenDirection, value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    if (direction === 'prompt') this.counts.promptTokens += value;
    else this.counts.completionTokens += value;
  }

  recordLatencyMs(value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    this.latency[this.latencyHead] = value;
    this.latencyHead = (this.latencyHead + 1) % this.bufferSize;
    if (this.latencyCount < this.bufferSize) this.latencyCount += 1;
  }

  recordRateLimitRejection(): void {
    this.counts.rateLimitRejections += 1;
  }

  snapshot(): MetricsSnapshot {
    return {
      inference: {
        requests: {
          success: this.counts.success,
          failed: this.counts.failed,
          cancelled: this.counts.cancelled,
        },
        tokens: {
          prompt: this.counts.promptTokens,
          completion: this.counts.completionTokens,
        },
        latencyMs: this.latencyStats(),
      },
      workers: {
        connected: safeGauge(this.workersConnected),
        capacity: safeGauge(this.workersCapacity),
      },
      rateLimit: { rejections: this.counts.rateLimitRejections },
    };
  }

  private latencyStats(): MetricsSnapshot['inference']['latencyMs'] {
    if (this.latencyCount === 0) {
      return { count: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }
    const samples = this.latency.slice(0, this.latencyCount).sort((a, b) => a - b);
    const sum = samples.reduce((acc, n) => acc + n, 0);
    const avg = sum / samples.length;
    return {
      count: samples.length,
      avg: round2(avg),
      p50: round2(percentile(samples, 0.5)),
      p95: round2(percentile(samples, 0.95)),
      p99: round2(percentile(samples, 0.99)),
    };
  }
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0] as number;
  const rank = q * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo] as number;
  const frac = rank - lo;
  return (sorted[lo] as number) * (1 - frac) + (sorted[hi] as number) * frac;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function safeGauge(fn: () => number): number {
  try {
    const v = fn();
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}
