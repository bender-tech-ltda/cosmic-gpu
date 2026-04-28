// Shared backend-mocking helpers for the E2E specs.
//
// We intercept every backend call inside the browser via `page.route` so
// the specs are deterministic and don't require a running Hyperswarm
// stack. All endpoints return the canonical wire shape from
// `@cosmic/shared` so any drift between frontend / backend would
// surface here too.

import type { Page } from '@playwright/test';

export interface MockApiKey {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
  prefix: string;
}

export interface MockBackendState {
  keys: MockApiKey[];
}

export function makeKey(overrides: Partial<MockApiKey> = {}): MockApiKey {
  return {
    id: 'ak_default',
    name: 'demo-key',
    scopes: ['inference:read'],
    createdAt: '2024-01-01T00:00:00.000Z',
    revokedAt: null,
    prefix: 'sk-AbCd...',
    ...overrides,
  };
}

/**
 * Install backend mocks on the given page. Mutating the returned `state`
 * affects subsequent intercepted requests, which is enough to model the
 * create / revoke flow without a real backend.
 */
export async function mockBackend(
  page: Page,
  initial: Partial<MockBackendState> = {},
): Promise<MockBackendState> {
  const state: MockBackendState = {
    keys: initial.keys ?? [],
  };

  await page.route('**/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        uptimeSeconds: 123,
        p2p: { connected: true, peers: 3 },
        version: '0.1.0',
      }),
    });
  });

  await page.route('**/metrics', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        inference: {
          requests: { success: 12, failed: 1, cancelled: 2 },
          tokens: { prompt: 500, completion: 800 },
          latencyMs: { count: 12, avg: 142.7, p50: 100, p95: 240, p99: 280 },
        },
        workers: { connected: 3, capacity: 12 },
        rateLimit: { rejections: 0 },
      }),
    });
  });

  await page.route('**/v1/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        object: 'list',
        data: [
          {
            id: 'mock-llm',
            object: 'model',
            owned_by: 'cosmic',
            capabilities: { streaming: true, max_context: 4096 },
          },
        ],
      }),
    });
  });

  await page.route('**/v1/api-keys', async (route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: state.keys }),
      });
      return;
    }
    if (request.method() === 'POST') {
      const body = JSON.parse(request.postData() ?? '{}') as { name: string };
      const id = `ak_${Math.random().toString(36).slice(2, 10)}`;
      const plaintext = `sk-${id.toUpperCase()}-PLAINTEXT`;
      const created: MockApiKey = makeKey({
        id,
        name: body.name,
        prefix: `${plaintext.slice(0, 10)}...`,
      });
      state.keys = [created, ...state.keys];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ...created, plaintext }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/v1/api-keys/*', async (route, request) => {
    if (request.method() === 'DELETE') {
      const url = new URL(request.url());
      const id = url.pathname.split('/').pop() ?? '';
      state.keys = state.keys.map((k) =>
        k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k,
      );
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fallback();
  });

  await page.route('**/v1/usage/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        apiKeyId: state.keys[0]?.id ?? 'ak_default',
        totals: { requests: 5, promptTokens: 120, completionTokens: 240 },
        windows: [
          {
            windowStart: '2024-01-01T00:00:00.000Z',
            requests: 3,
            promptTokens: 60,
            completionTokens: 120,
          },
          {
            windowStart: '2024-01-01T00:01:00.000Z',
            requests: 2,
            promptTokens: 60,
            completionTokens: 120,
          },
        ],
      }),
    });
  });

  return state;
}

/**
 * Mock the streaming chat-completions endpoint with two `data:` chunks +
 * `[DONE]`. The body is a plain string; our SSE parser walks `\n\n`
 * separators and handles a fully-buffered response just as well as a
 * trickle.
 */
export async function mockChatCompletionStream(
  page: Page,
  chunks: string[] = ['hello ', 'world'],
): Promise<void> {
  await page.route('**/v1/chat/completions', async (route, request) => {
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }
    const events = chunks
      .map(
        (delta) =>
          `data: ${JSON.stringify({
            id: 'job_demo',
            object: 'chat.completion.chunk',
            created: 1,
            model: 'mock-llm',
            choices: [
              { index: 0, delta: { role: 'assistant', content: delta }, finish_reason: null },
            ],
          })}\n\n`,
      )
      .join('');
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `${events}data: [DONE]\n\n`,
    });
  });
}

/** Pre-seed the session storage with an active API key. */
export async function setActiveKey(page: Page, key: string): Promise<void> {
  await page.addInitScript((value) => {
    window.sessionStorage.setItem('cosmic.apiKey', value);
  }, key);
}
