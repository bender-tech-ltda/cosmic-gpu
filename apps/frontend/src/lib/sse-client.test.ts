import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './api-error.js';
import { streamChatCompletion } from './sse-client.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function mockSseResponse(chunks: string[], status = 200): void {
  globalThis.fetch = vi.fn(
    async () =>
      new Response(streamFromChunks(chunks), {
        status,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
  ) as typeof fetch;
}

describe('streamChatCompletion', () => {
  it('yields each parsed chunk and stops at [DONE]', async () => {
    mockSseResponse([
      'data: {"id":"j1","object":"chat.completion.chunk","created":1,"model":"m","choices":[{"index":0,"delta":{"content":"hi "},"finish_reason":null}]}\n\n',
      'data: {"id":"j1","object":"chat.completion.chunk","created":1,"model":"m","choices":[{"index":0,"delta":{"content":"there"},"finish_reason":null}]}\n\n',
      'data: [DONE]\n\n',
    ]);

    const out: string[] = [];
    for await (const frame of streamChatCompletion('sk-X', {
      model: 'm',
      messages: [{ role: 'user', content: 'hello' }],
    })) {
      const delta = frame.choices[0]?.delta.content ?? '';
      if (delta) out.push(delta);
    }
    expect(out).toEqual(['hi ', 'there']);
  });

  it('throws ApiError on initial non-2xx envelope', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ statusCode: 401, code: 'ApiKeyInvalid', message: 'bad' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as typeof fetch;

    const iter = streamChatCompletion('sk-X', {
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
    });
    await expect(
      (async () => {
        for await (const _ of iter) {
          /* drain */
        }
      })(),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError when a mid-stream error frame arrives', async () => {
    mockSseResponse([
      'data: {"id":"j","object":"chat.completion.chunk","created":1,"model":"m","choices":[{"index":0,"delta":{"content":"part"},"finish_reason":null}]}\n\n',
      'data: {"error":{"statusCode":503,"code":"WorkerTimeout","message":"timeout"}}\n\n',
    ]);

    const iter = streamChatCompletion('sk-X', {
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
    });
    let caught: unknown;
    try {
      for await (const _ of iter) {
        /* drain */
      }
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe('WorkerTimeout');
  });

  it('handles split SSE events across chunk boundaries', async () => {
    // First fetch chunk contains an incomplete event; the second completes it.
    mockSseResponse([
      'data: {"id":"j","object":"chat.completion.chunk","created":1,"model":"m","choices":[{"index":0,"delta":{"content":"split"',
      '},"finish_reason":null}]}\n\n',
      'data: [DONE]\n\n',
    ]);

    const out: string[] = [];
    for await (const frame of streamChatCompletion('sk-X', {
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
    })) {
      const delta = frame.choices[0]?.delta.content ?? '';
      if (delta) out.push(delta);
    }
    expect(out).toEqual(['split']);
  });
});
