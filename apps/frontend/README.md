# `@cosmic/frontend` — React + Vite Dashboard

The web UI for the Cosmic GPU cloud. Three pages — **API keys**, **Playground**, **Dashboard** — that exercise both headline features (API key management with auth + rate limiting, OpenAI-compatible streaming inference) end-to-end against the backend.

## Stack

- **React 18** + **Vite** + **TypeScript** (strict mode).
- **TanStack Query** for server state (caching, polling, mutation invalidation).
- **React Router** for navigation.
- **Tailwind CSS** for styling.
- **Vitest** + `@testing-library/react` for unit / component tests.
- **Playwright** for end-to-end happy-path tests against the real Vite dev server.

## Demo walkthrough (the video script)

This walkthrough mirrors the order the reviewer will see in the demo video. Every step has a literal expected outcome.

### Pre-requisites

```bash
# In one terminal — backend + 3 workers via Compose
pnpm compose:up
# (or `docker compose --profile p2p-local up --build` if the public DHT is unreachable)

# In another terminal — frontend dev server (proxies to the backend)
pnpm --filter @cosmic/frontend dev
```

The frontend serves on http://localhost:5173. The Swagger UI is at http://localhost:3000/docs (also proxied to http://localhost:5173/docs).

### 1. Land on the dashboard

Open http://localhost:5173. The app boots and immediately redirects to **`/keys`**.

**What you see**

- Header: "Cosmic GPU Cloud" + a three-item nav (`API keys`, `Playground`, `Dashboard`).
- An "API keys" page with a `Create a key` form and an empty-state message: "No API keys yet — Create your first key above. The plaintext is returned exactly once."

### 2. Create your first API key

In the **Name** field, type `demo-key` and click **Create key**.

**What you see**

- A green-rimmed banner appears at the top: **"New API key — copy it now"**, with the full plaintext `sk-...` value rendered in a monospace box and a **Copy** button.
- The active key is now set automatically (this is shown by the **Clear active key** button appearing in the "Existing keys" header).
- The new row appears in the "Existing keys" list with the key id, prefix, and creation timestamp.

**Talk track for the video**

> The plaintext is returned exactly once on creation — we hash with HMAC-SHA-256 and only store the digest server-side. After dismissing this banner, only the prefix is recoverable; that mirrors the OpenAI / Stripe API-key contract.

Click **Copy** to put it on the clipboard, then dismiss the banner with the `×` button.

### 3. Run an inference (Playground)

Click **Playground** in the top nav.

**What you see**

- Heading "Playground", a one-line description, and a `Prompt` card with a Model picker (`mock-llm`) and a `Message` textarea.
- Three buttons: **Send** (disabled until you type), **Stop** (disabled until you Send), **Clear**.
- An empty `Response` card with grey placeholder text.

Type any prompt (e.g. `say hi`) and click **Send**.

**What you see**

- The Send button changes to **Streaming…** and is disabled.
- Tokens stream into the **Response** card as they arrive — you'll see a blinking cursor at the trailing edge.
- The chunk counter at the bottom increments as each chunk arrives.
- An "Elapsed XX ms" indicator shows the wall-clock time on the right.
- When the worker emits `[DONE]`, Send re-enables and the elapsed indicator switches to "Took".

**Talk track for the video**

> The browser opens an SSE stream to `POST /v1/chat/completions` with `stream: true`. The backend dispatches via Hyperswarm RPC + Protomux substream to a worker, which streams synthetic tokens with a deterministic seed derived from the job id. The Stop button cancels via `AbortController` — the chain propagates: client closes the SSE → backend aborts the dispatcher generator → Protomux channel closes → worker generator emits `finishReason: 'cancelled'`.

### 4. Cancel mid-stream

Click **Send** again, and immediately press **Stop** while tokens are still arriving.

**What you see**

- Streaming halts within ~one chunk.
- Send re-enables.
- The chunk counter reflects only the chunks that arrived before cancellation.

**Talk track for the video**

> No `Error` is shown — cancellation is a clean exit. On the backend the dispatcher records the run with `finishReason: 'cancelled'` and `metrics.requests.cancelled` ticks up, which we'll see on the Dashboard next.

### 5. Telemetry (Dashboard)

Click **Dashboard** in the top nav.

**What you see (within ~5 s of any inference)**

- A green **Healthy** banner at the top with `N peers connected · v0.1.0`.
- A 6-card stat grid:
  - **Successful** — count of completed inferences (`X failed · Y cancelled` in the hint).
  - **Tokens (prompt + completion)** — total token volume.
  - **Latency p95** — with `p50 / p99 / n=` in the hint.
  - **Workers connected** — with `capacity X` in the hint.
  - **Rate-limit rejections** — count of 429 envelopes.
  - **Avg latency** — rolling-window average.
- A **Your usage** card with three sub-stats (`Requests` / `Prompt tokens` / `Completion tokens`) and a `Window | Requests | Prompt | Completion` table showing the last 24 minutely windows for the active key.

The whole grid polls every 5 s — refresh by waiting, or by hitting the page again.

**Talk track for the video**

> Counters are kept in an in-memory `MetricsRegistry` on the backend (latency in a 1000-sample ring buffer, percentiles computed on snapshot). The Hyperswarm `connected` and `capacity` gauges read live from the worker registry. Counters reset on backend restart — that trade-off is documented in `docs/architecture.md` §4.2; persistence + Prometheus exposition are §6 future improvements.

### 6. Revoke a key

Navigate back to **API keys**.

In the row for `demo-key`, click **Revoke** and confirm the prompt.

**What you see**

- The button text changes to **Revoking…** briefly.
- The row updates: a grey `revoked` badge appears next to the key name; the button now reads **Revoked** and is disabled.
- The Existing keys list still includes the key (revocation is non-destructive).

**Talk track for the video**

> Revoke is a `DELETE /v1/api-keys/:id`, which marks the row as revoked but leaves it in storage so audits stay accurate. Subsequent inference calls with the same plaintext fail with a `403 ApiKeyRevoked` envelope, distinct from `401 ApiKeyInvalid` for unknown / malformed keys.

### Variants worth showing in the video

- **No-key state on `/playground`.** Click **Clear active key** on `/keys`, then visit `/playground`. The page renders an empty state with a "Go to API keys" CTA — proves the auth-aware UX path.
- **Network failure recovery.** Stop the backend container; visit `/dashboard`. The cards switch to the loading state, then the health banner flips to amber **Degraded**. Restart the backend; both recover within ~5 s without a page reload.

## Pages reference

| Route         | Purpose                                                                    | Hooks consumed                                            |
| ------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- |
| `/keys`       | Create / list / revoke API keys; one-time plaintext display; set-active UX | `useApiKeys`, `useCreateApiKey`, `useRevokeApiKey`        |
| `/playground` | Prompt + SSE streaming response + stop / clear                             | `useModels`, `useStreamChatCompletion`, `useActiveApiKey` |
| `/dashboard`  | Health banner + 6 stat cards + per-key usage windows                       | `useHealth`, `useMetrics`, `useUsageMe`                   |

## Project layout

```
apps/frontend/
├── e2e/                # Playwright happy-path specs (one per page)
│   ├── fixtures.ts     # mockBackend / mockChatCompletionStream / setActiveKey
│   ├── keys.spec.ts
│   ├── playground.spec.ts
│   └── dashboard.spec.ts
├── src/
│   ├── components/     # Tailwind primitives (Button, Card, EmptyState, …)
│   ├── hooks/          # TanStack Query hooks (one per resource) + useActiveApiKey
│   ├── lib/            # api-client, sse-client, api-key-store, format
│   ├── pages/          # KeysPage, PlaygroundPage, DashboardPage
│   ├── App.tsx         # ErrorBoundary → QueryClient → BrowserRouter → AppShell
│   ├── main.tsx        # Vite entrypoint
│   └── styles.css      # Tailwind base + minimal custom overrides
├── playwright.config.ts
├── vite.config.ts
└── vitest.config.ts
```

## Scripts

```bash
pnpm --filter @cosmic/frontend dev          # vite dev server on :5173 (proxies /v1, /health, /metrics, /docs to the backend on :3000)
pnpm --filter @cosmic/frontend build        # tsc --noEmit && vite build → dist/
pnpm --filter @cosmic/frontend preview      # serve the production bundle
pnpm --filter @cosmic/frontend test         # vitest (unit + component)
pnpm --filter @cosmic/frontend test --run   # vitest run (CI mode)
pnpm --filter @cosmic/frontend e2e          # Playwright headless (boots Vite, mocks backend)
pnpm --filter @cosmic/frontend e2e:ui       # Playwright UI mode (interactive)
pnpm --filter @cosmic/frontend e2e:install  # one-time: download Chromium binary
pnpm --filter @cosmic/frontend lint
pnpm --filter @cosmic/frontend typecheck
```

## End-to-end testing

Three Playwright specs cover the happy path of each page. They run against the **real Vite dev server** (so React, Router, TanStack Query, and the SSE client are all exercised) but the backend is intercepted at the network level via `page.route(...)` — no real Hyperswarm or worker pool is required. This keeps the suite deterministic and fast (~5 s for all 3 specs on a laptop).

```bash
# One-time browser binary install
pnpm --filter @cosmic/frontend e2e:install

# Run the suite
pnpm --filter @cosmic/frontend e2e
```

After a failed run, open the HTML report:

```bash
pnpm --filter @cosmic/frontend exec playwright show-report
```

## State management

- **Server state** — TanStack Query. Resource hooks live in `src/hooks/use*.ts`. `staleTime: 0` + `refetchInterval: 5_000` for the dashboard polls.
- **Bearer key state** — `sessionStorage` via `src/lib/api-key-store.ts` (per `frontend-standards.mdc`: never `localStorage` long-term without explicit consent UI). The `useActiveApiKey` hook re-renders on changes via `useSyncExternalStore`.
- **URL is state** for routing only.
- **No Zustand stores yet** — the take-home doesn't need any UI-only state beyond what `useState` covers in each page. The dependency is installed; introduce a store the moment a feature needs cross-component UI state.

## Environment variables

| Name               | Default | Notes                                                                                                                                                 |
| ------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_BACKEND_URL` | (empty) | Empty string in dev → the Vite proxy forwards `/v1`, `/health`, `/metrics`, `/docs` to `http://localhost:3000`. Set to an absolute URL in production. |

## Related rules

- [`frontend-standards.mdc`](../../.cursor/rules/frontend-standards.mdc) — required UX states, API client conventions, forbidden patterns.
- [`testing-standards.mdc`](../../.cursor/rules/testing-standards.mdc) — Vitest + RTL conventions; E2E happy-path requirement.
- [`api-documentation.mdc`](../../.cursor/rules/api-documentation.mdc) — DTO shapes the frontend consumes via `@cosmic/shared`.
- [`markdown-style.mdc`](../../.cursor/rules/markdown-style.mdc) — applies to this README.

## Out-of-scope (intentional)

- **Live charts / sparklines on the dashboard.** Stat cards + a windowed table cover the FR-12 requirement and stay reviewable inside the take-home time budget. Sparklines are listed under `docs/architecture.md` §6.
- **Persistent active key.** We deliberately use `sessionStorage`, not `localStorage`. Closing the tab forgets the key, which forces a fresh demo path.
- **WebSocket / push-based dashboard updates.** 5 s polling is enough for the demo; a WebSocket upgrade is captured as a future improvement.
