import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './api-client.js';
import { ApiError } from './api-error.js';

interface MockCall {
  url: string;
  init: RequestInit;
}

let calls: MockCall[];

function mockFetch(impl: (call: MockCall) => Response | Promise<Response>): void {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const call = { url, init: init ?? {} };
    calls.push(call);
    return impl(call);
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiClient.health', () => {
  it('issues GET /health and returns the parsed envelope', async () => {
    const body = {
      status: 'ok',
      uptimeSeconds: 1,
      p2p: { connected: true, peers: 3 },
      version: '0.1.0',
    };
    mockFetch(() => new Response(JSON.stringify(body), { status: 200 }));

    const result = await apiClient.health();
    expect(result).toEqual(body);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toMatch(/\/health$/);
  });
});

describe('apiClient.createApiKey', () => {
  it('POSTs JSON and returns the created key envelope', async () => {
    const body = {
      id: 'ak_abc',
      name: 'cli',
      scopes: ['inference:read'],
      createdAt: '2024-01-01T00:00:00.000Z',
      revokedAt: null,
      prefix: 'sk-AbCd...',
      plaintext: 'sk-XYZ',
    };
    mockFetch(() => new Response(JSON.stringify(body), { status: 201 }));

    const result = await apiClient.createApiKey({ name: 'cli' });
    expect(result.id).toBe('ak_abc');
    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({ name: 'cli' });
  });
});

describe('apiClient.revokeApiKey', () => {
  it('DELETEs and resolves on 204', async () => {
    mockFetch(() => new Response(null, { status: 204 }));
    await expect(apiClient.revokeApiKey('ak_x')).resolves.toBeUndefined();
    expect(calls[0]?.init.method).toBe('DELETE');
    expect(calls[0]?.url).toMatch(/\/v1\/api-keys\/ak_x$/);
  });
});

describe('apiClient error mapping', () => {
  it('throws ApiError when the backend sends an envelope', async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ statusCode: 401, code: 'ApiKeyInvalid', message: 'bad' }), {
          status: 401,
        }),
    );

    await expect(apiClient.listApiKeys()).rejects.toBeInstanceOf(ApiError);
  });

  it('throws a synthetic ApiError on network failure', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('boom');
    }) as typeof fetch;
    await expect(apiClient.health()).rejects.toMatchObject({
      code: 'NetworkError',
      message: 'boom',
    });
  });
});

describe('apiClient.usageMe', () => {
  it('threads the bearer token into the Authorization header', async () => {
    mockFetch(
      () =>
        new Response(
          JSON.stringify({
            apiKeyId: 'ak_x',
            totals: { requests: 0, promptTokens: 0, completionTokens: 0 },
            windows: [],
          }),
          { status: 200 },
        ),
    );
    await apiClient.usageMe('sk-XYZ');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-XYZ');
  });
});
