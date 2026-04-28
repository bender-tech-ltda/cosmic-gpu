import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import KeysPage from './KeysPage.js';
import { createTestQueryWrapper } from '../hooks/test-utils.js';
import { setActiveApiKey } from '../lib/api-key-store.js';

interface FetchCall {
  url: string;
  init: RequestInit;
}

let calls: FetchCall[];

function setMockFetch(handler: (call: FetchCall) => Response | Promise<Response>): void {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const call = { url, init: init ?? {} };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
}

function renderKeysPage(): void {
  const { wrapper: QueryWrapper } = createTestQueryWrapper();
  render(
    <QueryWrapper>
      <MemoryRouter>
        <KeysPage />
      </MemoryRouter>
    </QueryWrapper>,
  );
}

beforeEach(() => {
  calls = [];
  setActiveApiKey(null);
  // Default: empty list.
  setMockFetch(({ url }) => {
    if (url.endsWith('/v1/api-keys')) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    return new Response('', { status: 404 });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('<KeysPage />', () => {
  it('shows the empty state when no keys exist', async () => {
    renderKeysPage();
    await waitFor(() => expect(screen.getByText(/No API keys yet/i)).toBeInTheDocument());
    expect(screen.getByText(/Create your first key/i)).toBeInTheDocument();
  });

  it('renders the existing keys when the list is non-empty', async () => {
    setMockFetch(
      () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'ak_one',
                name: 'cli',
                scopes: [],
                createdAt: '2024-01-01T00:00:00.000Z',
                revokedAt: null,
                prefix: 'sk-AbCd...',
              },
            ],
          }),
          { status: 200 },
        ),
    );
    renderKeysPage();
    const list = await screen.findByTestId('keys-list');
    expect(within(list).getByText('cli')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: /revoke key cli/i })).toBeInTheDocument();
  });

  it('disables the Create button while the name is empty', () => {
    renderKeysPage();
    const submit = screen.getByRole('button', { name: /create key/i });
    expect(submit).toBeDisabled();
  });

  it('shows the one-time plaintext banner after a successful create', async () => {
    let createCallCount = 0;
    setMockFetch(({ url, init }) => {
      if (url.endsWith('/v1/api-keys') && init.method === 'POST') {
        createCallCount += 1;
        return new Response(
          JSON.stringify({
            id: 'ak_new',
            name: 'cli',
            scopes: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            revokedAt: null,
            prefix: 'sk-Zz...',
            plaintext: 'sk-PLAINTEXT-XYZ',
          }),
          { status: 201 },
        );
      }
      // After creation the list is refetched; return a list containing the
      // new key.
      if (url.endsWith('/v1/api-keys')) {
        return new Response(
          JSON.stringify({
            data:
              createCallCount > 0
                ? [
                    {
                      id: 'ak_new',
                      name: 'cli',
                      scopes: [],
                      createdAt: '2024-01-01T00:00:00.000Z',
                      revokedAt: null,
                      prefix: 'sk-Zz...',
                    },
                  ]
                : [],
          }),
          { status: 200 },
        );
      }
      return new Response('', { status: 404 });
    });

    renderKeysPage();

    fireEvent.change(screen.getByPlaceholderText(/cli-laptop/i), { target: { value: 'cli' } });
    fireEvent.click(screen.getByRole('button', { name: /create key/i }));

    await waitFor(() =>
      expect(screen.getByTestId('created-key-plaintext')).toHaveTextContent('sk-PLAINTEXT-XYZ'),
    );
    expect(screen.getByText(/Copy/)).toBeInTheDocument();
  });
});
