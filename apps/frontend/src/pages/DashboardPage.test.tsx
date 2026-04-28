import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from './DashboardPage.js';
import { createTestQueryWrapper } from '../hooks/test-utils.js';
import { setActiveApiKey } from '../lib/api-key-store.js';

function renderDashboard(): void {
  const { wrapper: QueryWrapper } = createTestQueryWrapper();
  render(
    <QueryWrapper>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryWrapper>,
  );
}

beforeEach(() => {
  setActiveApiKey(null);
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/health')) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          uptimeSeconds: 100,
          p2p: { connected: true, peers: 3 },
          version: '0.1.0',
        }),
        { status: 200 },
      );
    }
    if (url.endsWith('/metrics')) {
      return new Response(
        JSON.stringify({
          inference: {
            requests: { success: 12, failed: 1, cancelled: 2 },
            tokens: { prompt: 500, completion: 800 },
            latencyMs: { count: 12, avg: 142.7, p50: 100, p95: 240, p99: 280 },
          },
          workers: { connected: 3, capacity: 12 },
          rateLimit: { rejections: 0 },
        }),
        { status: 200 },
      );
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('<DashboardPage />', () => {
  it('shows the Healthy banner when /health reports peers > 0', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/Healthy/i)).toBeInTheDocument());
    expect(screen.getByText(/3 peers connected/i)).toBeInTheDocument();
  });

  it('renders the metrics stat cards from the snapshot', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/Workers connected/i)).toBeInTheDocument());
    expect(screen.getByText(/Successful/i)).toBeInTheDocument();
    expect(screen.getByText(/Latency p95/i)).toBeInTheDocument();
    expect(screen.getByText(/240 ms/)).toBeInTheDocument();
    expect(screen.getByText(/Rate-limit rejections/i)).toBeInTheDocument();
  });

  it('shows the empty-state in Your Usage when no key is active', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/Set an active API key/i)).toBeInTheDocument());
  });
});
