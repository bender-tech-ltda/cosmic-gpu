import { describe, expect, it } from 'vitest';

import { MetricsRegistry } from './metrics.js';

describe('MetricsRegistry', () => {
  it('returns a zeroed snapshot before anything is recorded', () => {
    const m = new MetricsRegistry();
    const snap = m.snapshot();
    expect(snap.inference.requests).toEqual({ success: 0, failed: 0, cancelled: 0 });
    expect(snap.inference.tokens).toEqual({ prompt: 0, completion: 0 });
    expect(snap.inference.latencyMs).toEqual({ count: 0, avg: 0, p50: 0, p95: 0, p99: 0 });
    expect(snap.workers).toEqual({ connected: 0, capacity: 0 });
    expect(snap.rateLimit).toEqual({ rejections: 0 });
  });

  it('counts request outcomes and token directions independently', () => {
    const m = new MetricsRegistry();
    m.recordRequest('success');
    m.recordRequest('success');
    m.recordRequest('failed');
    m.recordRequest('cancelled');
    m.recordTokens('prompt', 5);
    m.recordTokens('completion', 7);
    m.recordTokens('completion', 3);
    const snap = m.snapshot();
    expect(snap.inference.requests).toEqual({ success: 2, failed: 1, cancelled: 1 });
    expect(snap.inference.tokens).toEqual({ prompt: 5, completion: 10 });
  });

  it('ignores non-positive / non-finite token observations', () => {
    const m = new MetricsRegistry();
    m.recordTokens('prompt', 0);
    m.recordTokens('prompt', -3);
    m.recordTokens('completion', Number.POSITIVE_INFINITY);
    m.recordTokens('completion', Number.NaN);
    expect(m.snapshot().inference.tokens).toEqual({ prompt: 0, completion: 0 });
  });

  it('reports averages and percentiles over the last samples', () => {
    const m = new MetricsRegistry({ bufferSize: 10 });
    for (const v of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) m.recordLatencyMs(v);
    const snap = m.snapshot().inference.latencyMs;
    expect(snap.count).toBe(10);
    expect(snap.avg).toBe(55);
    expect(snap.p50).toBe(55); // midway between 50 and 60
    expect(snap.p95).toBeCloseTo(95.5, 2);
    expect(snap.p99).toBeCloseTo(99.1, 2);
  });

  it('overwrites the oldest sample when the buffer fills', () => {
    const m = new MetricsRegistry({ bufferSize: 3 });
    m.recordLatencyMs(1);
    m.recordLatencyMs(2);
    m.recordLatencyMs(3);
    m.recordLatencyMs(100); // displaces 1
    const snap = m.snapshot().inference.latencyMs;
    expect(snap.count).toBe(3);
    expect(snap.avg).toBeCloseTo((2 + 3 + 100) / 3, 2);
  });

  it('counts rate-limit rejections', () => {
    const m = new MetricsRegistry();
    m.recordRateLimitRejection();
    m.recordRateLimitRejection();
    m.recordRateLimitRejection();
    expect(m.snapshot().rateLimit.rejections).toBe(3);
  });

  it('reads worker gauges via the late-bound callbacks', () => {
    const m = new MetricsRegistry();
    let connected = 0;
    let capacity = 0;
    m.attachWorkerGauges(
      () => connected,
      () => capacity,
    );
    expect(m.snapshot().workers).toEqual({ connected: 0, capacity: 0 });
    connected = 3;
    capacity = 12;
    expect(m.snapshot().workers).toEqual({ connected: 3, capacity: 12 });
  });

  it('clamps a NaN gauge to zero rather than leaking it into the snapshot', () => {
    const m = new MetricsRegistry({
      workersConnected: () => Number.NaN,
      workersCapacity: () => Number.POSITIVE_INFINITY,
    });
    expect(m.snapshot().workers).toEqual({ connected: 0, capacity: 0 });
  });
});
