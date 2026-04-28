# `@cosmic/frontend` — React + Vite Dashboard

The web dashboard for the Cosmic GPU cloud.

## Pages (Planned)

| Route         | Purpose                                                                      |
| ------------- | ---------------------------------------------------------------------------- |
| `/keys`       | Create / list / revoke API keys; copy plaintext on creation                  |
| `/playground` | OpenAI-style chat UI; streamed tokens via SSE; stop button                   |
| `/dashboard`  | Live metrics — request volume, tokens consumed, worker pool size, peer count |

## Stack

- **React 18** + **Vite** + **TypeScript** (strict mode).
- **TanStack Query** for server state (caching, polling, invalidation).
- **Zustand** for UI-only state.
- **React Router** for navigation.
- **Tailwind CSS** for styling.
- **Vitest** + `@testing-library/react` for tests.

## Project Structure

```
src/
├── pages/          # Route-level views
├── components/     # Reusable UI building blocks
├── hooks/          # TanStack Query hooks + custom hooks
├── stores/         # Zustand stores
├── lib/            # API client, SSE helpers, formatters
└── main.tsx        # Bootstrap + providers
```

## Scripts

```bash
pnpm --filter @cosmic/frontend dev        # vite (port 5173) — placeholder until Step 9
pnpm --filter @cosmic/frontend build      # currently `tsc --noEmit`; restored to `tsc -b && vite build → dist/` in Step 9
pnpm --filter @cosmic/frontend preview    # serve built bundle (post-Step-9)
pnpm --filter @cosmic/frontend test       # vitest (no test files until Step 10)
pnpm --filter @cosmic/frontend lint
pnpm --filter @cosmic/frontend typecheck
```

> **Status (pre-Step-9).** The frontend package is scaffolded — deps installed, scripts wired, ESLint + Vitest + Tailwind config in place — but `src/` only contains a placeholder export so the workspace `pnpm build` stays green. The Vite + React entrypoint, routing, providers, and pages all land in Steps 9 + 10.

## Environment Variables

- `VITE_BACKEND_URL` — base URL of the backend (default `http://localhost:3000`).

See [`../../.env.example`](../../.env.example).

## Related Rules

- [`frontend-standards.mdc`](../../.cursor/rules/frontend-standards.mdc)
- [`testing-standards.mdc`](../../.cursor/rules/testing-standards.mdc)
- [`api-documentation.mdc`](../../.cursor/rules/api-documentation.mdc)
