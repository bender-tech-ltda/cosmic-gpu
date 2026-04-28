// Frontend runtime config.
//
// In dev (Vite proxy) the empty default works: the browser hits
// `/v1/...` on http://localhost:5173 and Vite forwards to the backend.
// In production, set `VITE_BACKEND_URL=https://api.example.com` at build
// time so the bundle calls the backend directly.

interface FrontendConfig {
  backendUrl: string;
  apiKeyStorage: 'sessionStorage' | 'localStorage';
  metricsRefreshMs: number;
  usageRefreshMs: number;
  healthRefreshMs: number;
}

function envOrEmpty(key: string): string {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  return meta.env?.[key] ?? '';
}

export const config: FrontendConfig = {
  // Empty string + Vite proxy in dev; absolute URL in prod.
  backendUrl: envOrEmpty('VITE_BACKEND_URL'),
  // Session-only by default per `frontend-standards.mdc` (no long-term
  // localStorage of bearer tokens without explicit consent UI).
  apiKeyStorage: 'sessionStorage',
  metricsRefreshMs: 5_000,
  usageRefreshMs: 5_000,
  healthRefreshMs: 5_000,
};
