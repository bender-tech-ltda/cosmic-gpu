# `@cosmic/frontend` — React + Vite Dashboard

The web UI for the Cosmic GPU cloud. Three pages — **API keys**, **Playground**, **Dashboard** — that exercise both headline features (API key management with auth + rate limiting, OpenAI-compatible streaming inference) end-to-end against the backend.

## Stack

- **React 18** + **Vite** + **TypeScript** (strict mode).
- **TanStack Query** for server state (caching, polling, mutation invalidation).
- **React Router** for navigation.
- **Tailwind CSS** for styling.
- **Vitest** + `@testing-library/react` for unit / component tests.
- **Playwright** for end-to-end happy-path tests against the real Vite dev server.

## Getting started

Run the backend + 3 workers in one terminal, the frontend in another:

```bash
# Terminal 1 — backend + workers (Hyperswarm)
pnpm compose:up
# (or `docker compose --profile p2p-local up --build` if the public DHT is unreachable)

# Terminal 2 — frontend dev server (proxies /v1, /health, /metrics, /docs to the backend)
pnpm --filter @cosmic/frontend dev
```

Then open <http://localhost:5173>. The Swagger UI is at <http://localhost:3000/docs> (also reachable through the frontend's proxy at <http://localhost:5173/docs>).

## Layout overview

The header is the same on every page:

- **Brand** (left): `Cosmic GPU Cloud`.
- **Active-key pill** (centre, visible only when an API key is set): a green pill `key: sk-XXXXX…`. Click it to navigate back to `/keys`. The pill never shows the full plaintext — only the first 10 characters of the prefix.
- **Primary nav** (right): `API keys`, `Playground`, `Dashboard`.

If you ever need to change which key is "active", everything happens on `/keys`. The active key is what every authenticated call (Playground inference, Dashboard's "Your usage" card) uses; it's stored in **sessionStorage**, so closing the tab forgets it.

## Page guide

### `/keys` — API keys

**Objective.** Create, list, and revoke the API keys that authenticate inference calls. The plaintext value of a newly-created key is shown **exactly once** — copy it now or you'll have to create a new one. The page also lets you paste a key you already have and select it as the active bearer.

#### "Create a key"

| Element               | What it does                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Name** input        | Friendly label for the key (1–64 chars; e.g. `cli-laptop`, `staging-bot`). Stored in plaintext server-side; not part of the secret. |
| **Create key** button | Disabled while the name is empty. Submits `POST /v1/api-keys`; on success returns the new key including the one-time plaintext.     |

After a successful create:

1. A green-rimmed banner **"New API key — copy it now"** appears at the top of the page with the full plaintext in a monospace box.
2. Click **Copy** (or select + Cmd-C) to put it on your clipboard.
3. The key is **automatically set as the active key** for this tab — you'll see the green pill appear in the header.
4. Dismiss the banner with the `×` button. After that, only the prefix (first 10 chars) is recoverable from the UI.

#### "Use an existing key"

| Element                                              | What it does                                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plaintext key** input (password-masked)            | Paste any plaintext key you already have. Trimmed of surrounding whitespace.                                                                                        |
| **Use this key** button                              | Disabled while the input is empty. Sets the value as the active bearer in sessionStorage; the field clears on submit.                                               |
| **Clear active key** button (only when a key is set) | Removes the active key from sessionStorage. The header pill disappears, and `/playground` and the Dashboard's "Your usage" card switch back to their no-key states. |

Use this whenever you need to:

- Switch between two keys you've created in this tab.
- Re-use a key you generated outside the UI (e.g. via `curl`).
- Test what happens with a deliberately-malformed key (the inference call will surface a typed `ApiError` envelope on the Playground).

#### "Existing keys"

| Element           | What it does                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Row               | One per key. Shows the key's name, id, prefix, and creation timestamp. A grey `revoked` badge appears next to the name when the key has been revoked.                    |
| **Revoke** button | Confirms via `window.confirm`, then issues `DELETE /v1/api-keys/:id`. Idempotent on already-revoked rows. After revocation the button reads **Revoked** and is disabled. |

Revocation is non-destructive — the row stays in the list. Subsequent inference calls with that key will fail with a typed `403 ApiKeyRevoked` envelope (visible on the Playground).

---

### `/playground` — Inference

**Objective.** Send a prompt to a worker over Hyperswarm and stream the response back via SSE. Demonstrates the streaming inference pipeline end-to-end: bearer auth → backend dispatcher → Protomux substream to the worker → token-by-token deltas → `[DONE]` terminator. The Stop button proves cancellation works the whole way down.

If no key is active, the page shows an empty state with a "Go to API keys" CTA. Set an active key on `/keys` first.

#### "Prompt"

| Element                   | What it does                                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Model** picker          | Lists models served by the connected worker pool (sourced from `GET /v1/models`). Falls back to `mock-llm` when the registry hasn't seen any worker yet.                                           |
| **Message** textarea      | The user message sent to the model.                                                                                                                                                                |
| **Send** button           | Disabled until the textarea has content **and** there's no active stream. While streaming, the label changes to **Streaming…**. Issues `POST /v1/chat/completions` with `stream: true`.            |
| **Stop** button           | Disabled until a stream is active. Aborts the `AbortController`; the close propagates to the dispatcher → Protomux channel → worker generator (which terminates with `finishReason: 'cancelled'`). |
| **Clear** button          | Wipes the response area, error banner, and the elapsed-time indicator. Disabled mid-stream.                                                                                                        |
| Elapsed-time hint (right) | While streaming: `Elapsed XX ms` ticks up. After completion: `Took XXX ms`.                                                                                                                        |

#### "Response"

| Element                | What it does                                                                                                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Response region        | Tokens stream in as they arrive. Uses `aria-live="polite"` so screen readers announce each chunk. A blinking caret marks the trailing edge while streaming.                                                                            |
| Chunk counter (footer) | `N chunk(s) received.` Increments per delta frame.                                                                                                                                                                                     |
| Error banner           | Surfaces typed `ApiError`s (e.g. `401 ApiKeyInvalid`, `403 ApiKeyRevoked`, `429 RateLimited`, `503 NoWorkersAvailable`, `503 WorkerTimeout`). The error code is shown as a label so you can pattern-match without parsing the message. |

---

### `/dashboard` — Telemetry

**Objective.** Show what the backend is observing in real time: swarm health, inference counters, latency percentiles, worker pool size, rate-limit rejections, and the active key's per-window usage. Polls every 5 seconds via TanStack Query.

| Section                          | What it does                                                                                                                                                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Health banner**                | Green **Healthy** when `/health` reports `status: "ok"` + at least one peer; amber **Degraded** otherwise. The peer count and backend version are shown inline.                                                                                                                  |
| **Successful**                   | Count of inferences with `finishReason: stop \| length`. The hint also shows `failed` and `cancelled` counts.                                                                                                                                                                    |
| **Tokens (prompt + completion)** | Total token volume across all requests. Hint splits prompt vs completion.                                                                                                                                                                                                        |
| **Latency p95**                  | 95th-percentile end-to-end latency (request received → final envelope written). Hint includes `p50`, `p99`, and `n=` (sample count from the rolling 1000-sample buffer).                                                                                                         |
| **Workers connected**            | Live worker count from the registry. Hint shows summed `capacity`.                                                                                                                                                                                                               |
| **Rate-limit rejections**        | Count of 429 envelopes since backend start.                                                                                                                                                                                                                                      |
| **Avg latency**                  | Rolling-window average.                                                                                                                                                                                                                                                          |
| **Your usage** card              | Visible only when an API key is active. Three sub-stats (`Requests` / `Prompt tokens` / `Completion tokens`) summed across all windows for the active key. The table below shows up to 24 most-recent minutely windows, newest first. Empty state when the key has no usage yet. |

> All counters are kept in an in-memory `MetricsRegistry` on the backend and **reset on backend restart**. The trade-off is documented in `docs/architecture.md` §4.3; persistence + Prometheus exposition are §6 future improvements.

## Manual test scenarios

The UI surfaces every state the backend can return. Use these as a manual test plan — each scenario is reachable from the running app without DevTools tricks.

### Happy path

1. `/keys` → Create a key named `demo` → see the plaintext banner; copy it.
2. Header shows the green `key: sk-…` pill.
3. `/playground` → type any prompt → **Send** → tokens stream into the response area.
4. `/dashboard` (within ~5 s) → **Successful** counter ticks up; `Your usage` table shows the request.

### No active key on `/playground`

1. `/keys` → click **Clear active key** (in the "Use an existing key" card).
2. The header pill disappears.
3. `/playground` → renders the **No active API key** empty state with a CTA back to `/keys`.

### Invalid bearer token

1. `/keys` → "Use an existing key" card → paste `sk-not-a-real-key` → **Use this key**.
2. `/playground` → enter any prompt → **Send**.
3. Response card shows an `ApiKeyInvalid` error banner; the response region stays empty.

### Revoked key

1. `/keys` → create a key (call it `to-revoke`); the plaintext is auto-set as active.
2. Copy the plaintext from the banner before dismissing it.
3. Click **Revoke** on the row → confirm.
4. `/keys` → "Use an existing key" → paste the plaintext you copied → **Use this key**.
5. `/playground` → **Send** → banner shows `ApiKeyRevoked` (`403`).

### Cancellation mid-stream

1. With an active key, `/playground` → **Send** → as soon as you see the cursor, click **Stop**.
2. Streaming halts within a chunk or two; **Send** re-enables.
3. `/dashboard` → the **Successful** card hint shows the `cancelled` counter ticking up.

### Multi-key switching

1. Create key A → copy plaintext, dismiss banner.
2. Create key B → copy plaintext, dismiss banner. (B is now the active key per the auto-select on create.)
3. "Use an existing key" → paste A's plaintext → **Use this key**.
4. `/dashboard`'s **Your usage** table now shows A's usage windows; the active-key pill prefix changes accordingly.

### Backend down / recovery

1. `pnpm compose:down` (or stop the backend container).
2. `/dashboard` → the health banner flips to amber **Degraded**; metrics cards switch to loading; `Your usage` shows an error banner.
3. `pnpm compose:up`.
4. Within ~5 s the dashboard recovers — no page reload needed.

### Rate-limit (429)

The default backend limit is 60 requests / minute / key. To trigger it deliberately:

1. Stop the backend, set `RATE_LIMIT_RPM=2` in `.env`, restart it.
2. `/playground` → **Send** twice in quick succession.
3. The third **Send** lands a `RateLimited` (`429`) error banner with the `Retry-After` value embedded in the message.

## Pages reference (technical)

| Route         | Hooks consumed                                                        |
| ------------- | --------------------------------------------------------------------- |
| `/keys`       | `useApiKeys`, `useCreateApiKey`, `useRevokeApiKey`, `useActiveApiKey` |
| `/playground` | `useModels`, `useStreamChatCompletion`, `useActiveApiKey`             |
| `/dashboard`  | `useHealth`, `useMetrics`, `useUsageMe`                               |

## Project layout

```
apps/frontend/
├── e2e/                # Playwright happy-path specs (one per page)
│   ├── fixtures.ts     # mockBackend / mockChatCompletionStream / setActiveKey
│   ├── keys.spec.ts
│   ├── playground.spec.ts
│   └── dashboard.spec.ts
├── src/
│   ├── components/     # Tailwind primitives (Button, Card, EmptyState, …) + AppShell + ErrorBoundary
│   ├── hooks/          # TanStack Query hooks (one per resource) + useActiveApiKey
│   ├── lib/            # api-client, sse-client, api-key-store, format
│   ├── pages/          # KeysPage, PlaygroundPage, DashboardPage
│   ├── App.tsx         # ErrorBoundary → QueryClient → BrowserRouter → AppShell
│   ├── main.tsx        # Vite entrypoint
│   └── styles.css      # Tailwind base
├── playwright.config.ts
├── vite.config.ts
└── vitest.config.ts
```

## Scripts

```bash
pnpm --filter @cosmic/frontend dev          # vite dev server on :5173
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

Four Playwright specs cover the happy path of each page (plus the paste-existing-key flow). They run against the **real Vite dev server** (so React, Router, TanStack Query, and the SSE client are all exercised) but the backend is intercepted at the network level via `page.route(...)` — no real Hyperswarm or worker pool required. The suite is deterministic and finishes in under 2 s on a laptop.

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

## Environment variables

| Name               | Default | Notes                                                                                                                                          |
| ------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_BACKEND_URL` | (empty) | Empty in dev → the Vite proxy forwards `/v1`, `/health`, `/metrics`, `/docs` to `http://localhost:3000`. Set to an absolute URL in production. |

## Related rules

- [`frontend-standards.mdc`](../../.cursor/rules/frontend-standards.mdc) — required UX states, API client conventions, forbidden patterns.
- [`testing-standards.mdc`](../../.cursor/rules/testing-standards.mdc) — Vitest + RTL conventions; E2E happy-path requirement.
- [`api-documentation.mdc`](../../.cursor/rules/api-documentation.mdc) — DTO shapes the frontend consumes via `@cosmic/shared`.
- [`markdown-style.mdc`](../../.cursor/rules/markdown-style.mdc) — applies to this README.

## Out-of-scope (intentional)

- **Live charts / sparklines on the dashboard.** Stat cards + a windowed table cover FR-12 within the take-home time budget. Sparklines are listed under `docs/architecture.md` §6.
- **Persistent active key.** We deliberately use `sessionStorage`, not `localStorage`. Closing the tab forgets the key — the "Use an existing key" form lets you paste it back when you return.
- **WebSocket / push-based dashboard updates.** 5 s polling is enough for the demo; a WebSocket upgrade is captured as a future improvement.
