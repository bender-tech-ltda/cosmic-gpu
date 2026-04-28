import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import App from './App.js';
import { setActiveApiKey } from './lib/api-key-store.js';

beforeEach(() => {
  setActiveApiKey(null);
  // App boots /keys by default. KeysPage immediately fires `GET
  // /v1/api-keys`; stub it to an empty list so the page renders the
  // empty-state copy without a real backend.
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/v1/api-keys')) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('<App />', () => {
  it('renders the header brand and primary navigation', () => {
    render(<App />);
    expect(screen.getByText(/Cosmic/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /API keys/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Playground/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
  });

  it('redirects the index route to /keys and renders the page heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /API keys/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/cli-laptop/i)).toBeInTheDocument();
  });
});
