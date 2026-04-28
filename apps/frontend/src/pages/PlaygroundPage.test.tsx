import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PlaygroundPage from './PlaygroundPage.js';
import { createTestQueryWrapper } from '../hooks/test-utils.js';
import { setActiveApiKey } from '../lib/api-key-store.js';

function renderPlaygroundPage(): void {
  const { wrapper: QueryWrapper } = createTestQueryWrapper();
  render(
    <QueryWrapper>
      <MemoryRouter>
        <PlaygroundPage />
      </MemoryRouter>
    </QueryWrapper>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  setActiveApiKey(null);
});

describe('<PlaygroundPage /> empty state', () => {
  beforeEach(() => {
    setActiveApiKey(null);
  });

  it('shows the no-key empty state with a CTA to /keys', () => {
    renderPlaygroundPage();
    expect(screen.getByText(/No active API key/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Go to API keys/i })).toHaveAttribute('href', '/keys');
  });
});

describe('<PlaygroundPage /> streaming happy path', () => {
  beforeEach(() => {
    setActiveApiKey('sk-TEST');

    // Build a streamed response containing two chunks + [DONE].
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"id":"j","object":"chat.completion.chunk","created":1,"model":"mock-llm","choices":[{"index":0,"delta":{"content":"hello "},"finish_reason":null}]}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"id":"j","object":"chat.completion.chunk","created":1,"model":"mock-llm","choices":[{"index":0,"delta":{"content":"world"},"finish_reason":null}]}\n\n',
          ),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/v1/models')) {
        return new Response(
          JSON.stringify({
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
          { status: 200 },
        );
      }
      if (url.endsWith('/v1/chat/completions') && init?.method === 'POST') {
        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }
      return new Response('', { status: 404 });
    }) as typeof fetch;
  });

  it('streams text into the response region after Send', async () => {
    renderPlaygroundPage();
    fireEvent.change(screen.getByPlaceholderText(/Ask the model/i), {
      target: { value: 'hi' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      const region = screen.getByTestId('playground-response');
      expect(region).toHaveTextContent('hello world');
    });
  });
});
