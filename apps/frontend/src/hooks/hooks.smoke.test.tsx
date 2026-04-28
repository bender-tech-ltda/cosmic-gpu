import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useApiKeys } from './useApiKeys.js';
import { useMetrics } from './useMetrics.js';
import { createTestQueryWrapper } from './test-utils.js';

beforeEach(() => {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/v1/api-keys')) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    if (url.endsWith('/metrics')) {
      return new Response(
        JSON.stringify({
          inference: {
            requests: { success: 0, failed: 0, cancelled: 0 },
            tokens: { prompt: 0, completion: 0 },
            latencyMs: { count: 0, avg: 0, p50: 0, p95: 0, p99: 0 },
          },
          workers: { connected: 0, capacity: 0 },
          rateLimit: { rejections: 0 },
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ statusCode: 404, code: 'NotFound', message: 'no' }), {
      status: 404,
    });
  }) as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useApiKeys', () => {
  it('resolves to the empty list shape from the backend', async () => {
    const { wrapper } = createTestQueryWrapper();
    const { result } = renderHook(() => useApiKeys(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ data: [] });
  });
});

describe('useMetrics', () => {
  it('returns the zeroed snapshot shape', async () => {
    const { wrapper } = createTestQueryWrapper();
    const { result } = renderHook(() => useMetrics(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.workers).toEqual({ connected: 0, capacity: 0 });
    expect(result.current.data?.inference.requests).toEqual({
      success: 0,
      failed: 0,
      cancelled: 0,
    });
  });
});
