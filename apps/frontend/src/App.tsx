// Application shell. Composes:
//   - <QueryClientProvider>: TanStack Query for server state.
//   - <BrowserRouter>: client-side routing.
//   - <ErrorBoundary>: top-level fallback for render-time exceptions.
//   - Routes: /keys (default), /playground, /dashboard.
//
// Page implementations land in Step 10 — Step 9 only ships placeholders so
// the full stack (Vite → React → Router → Query) is wired and the API
// client is exercised by hooks in `src/hooks/`.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import AppShell from './components/AppShell.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import DashboardPage from './pages/DashboardPage.js';
import KeysPage from './pages/KeysPage.js';
import PlaygroundPage from './pages/PlaygroundPage.js';

// Single shared QueryClient. Defaults are tight for a take-home demo:
// - `staleTime: 0` so the dashboard always reflects the latest snapshot.
// - `refetchOnWindowFocus: false` so dev HMR doesn't burn requests.
// - `retry: 1` so a single transient failure isn't user-visible but a
//   genuine outage surfaces quickly.
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: { retry: 0 },
    },
  });
}

export default function App(): JSX.Element {
  const queryClient = createQueryClient();
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/keys" replace />} />
              <Route path="/keys" element={<KeysPage />} />
              <Route path="/playground" element={<PlaygroundPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="*" element={<Navigate to="/keys" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
