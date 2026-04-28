import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import App from './App.js';

beforeEach(() => {
  // App boots /keys by default; the page placeholder doesn't issue any
  // requests, but TanStack Query may still fire useQueries on subsequent
  // renders. Stub fetch to a no-op so any incidental call doesn't blow up
  // the test environment.
  globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as typeof fetch;
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

  it('redirects the index route to /keys and shows the placeholder copy', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /API keys/i })).toBeInTheDocument();
    expect(screen.getByText(/lands in Step 10/i)).toBeInTheDocument();
  });
});
