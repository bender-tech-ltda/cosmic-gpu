# Requirements Tracking

This file tracks the **40 requirements** extracted from the task brief and the job description, and how each step of our implementation moves them forward.

**Scoring scale**

| Score | Meaning                                       |
| ----- | --------------------------------------------- |
| 0%    | Not started                                   |
| 25%   | Started — scaffolding / configuration only    |
| 50%   | Partial implementation                        |
| 75%   | Implementation complete; tests / docs pending |
| 100%  | Fully done with tests and docs                |

**Update protocol**: this file is updated at the **end of every implementation step** with the new percentage and a one-line note.

---

## Functional Requirements (FR)

| ID    | Requirement                                |  S1 |  S2 |  S3 | S4a |  S4b | Notes                                                       |
| ----- | ------------------------------------------ | --: | --: | --: | --: | ---: | ----------------------------------------------------------- |
| FR-01 | Backend manages API keys (CRUD)            |  0% | 10% | 10% | 25% | 100% | Service + routes (POST/GET/DELETE) + 13 tests; Swagger live |
| FR-02 | Backend handles inference requests         |  0% | 10% | 10% | 10% |  10% | RPC schemas defined; routing Step 6                         |
| FR-03 | Backend simulates workload distribution    |  0% |  0% |  0% | 10% |  10% | Worker registry accessor available                          |
| FR-04 | P2P / distributed task queue               |  0% |  5% |  5% | 15% |  15% | Jobs accessor available                                     |
| FR-05 | Frontend — API key management UI           |  0% |  5% |  5% |  5% |  10% | Backend endpoints ready to consume                          |
| FR-06 | Frontend — usage monitoring UI             |  0% |  5% |  5% |  5% |   5% | Usage DTO defined                                           |
| FR-07 | Frontend — basic model deployment workflow |  0% |  5% |  5% |  5% |   5% | Model DTO defined                                           |
| FR-08 | OpenAI-compatible streaming endpoint       |  0% | 15% | 15% | 15% |  15% | Chunk DTO + SSE constants                                   |
| FR-09 | OpenAI-compatible non-streaming endpoint   |  0% | 15% | 15% | 15% |  20% | Auth plugin ready to gate the route                         |
| FR-10 | Usage tracking                             |  0% |  5% |  5% | 25% |  25% | UsageState accessor + windows logic                         |
| FR-11 | Rate limiting                              |  0% |  5% |  5% |  5% | 100% | Per-key + per-IP buckets; 429 envelope + Retry-After tests  |
| FR-12 | Metrics dashboard                          |  0% |  0% |  0% |  0% |   0% | —                                                           |
| FR-13 | Health check endpoint                      |  0% | 10% | 75% | 75% |  80% | Liveness route opted out of rate limit                      |

## Tech Stack Adherence (TS)

| ID    | Requirement                    |  S1 |  S2 |  S3 | S4a | S4b | Notes                                                                  |
| ----- | ------------------------------ | --: | --: | --: | --: | --: | ---------------------------------------------------------------------- |
| TS-01 | Node.js + Fastify backend      | 25% | 40% | 65% | 65% | 80% | Auth + rate-limit plugins added; Bearer security scheme exposed in OAS |
| TS-02 | Hyperswarm RPC / Hyperswarm    | 25% | 40% | 40% | 40% | 40% | Schemas only; runtime in Steps 5–6                                     |
| TS-03 | HyperDB (or similar K/V store) | 25% | 35% | 35% | 65% | 70% | Hyperbee adapter exercised end-to-end via API key lifecycle            |

## Non-Functional / Best Practices (NFR)

| ID     | Requirement                     |  S1 |  S2 |  S3 | S4a | S4b | Notes                                                                 |
| ------ | ------------------------------- | --: | --: | --: | --: | --: | --------------------------------------------------------------------- |
| NFR-01 | Clean modular architecture      | 50% | 60% | 70% | 80% | 85% | Service / plugin / route layering proven on first vertical slice      |
| NFR-02 | Proper error handling           |  0% | 15% | 50% | 50% | 70% | DomainError covers all auth + lifecycle paths; 429 mapped to envelope |
| NFR-03 | Input validation                |  0% | 25% | 40% | 40% | 60% | TypeBox-validated body / params on api-keys route                     |
| NFR-04 | Env-var configuration           | 50% | 50% | 75% | 80% | 80% | `STATE_BACKEND` added; auto-default in tests                          |
| NFR-05 | Async patterns / resource mgmt  |  0% |  0% | 30% | 40% | 45% | Async iterator list contract; onClose cleanup                         |
| NFR-06 | Frontend responsive             |  0% |  0% |  0% |  0% |  0% | —                                                                     |
| NFR-07 | Frontend state management       |  0% |  0% |  0% |  0% |  0% | —                                                                     |
| NFR-08 | Frontend real-time updates      |  0% |  0% |  0% |  0% |  0% | —                                                                     |
| NFR-09 | Frontend loading / error states |  0% |  0% |  0% |  0% |  0% | —                                                                     |
| NFR-10 | Local distributed simulation    |  0% |  0% |  0% |  0% |  0% | —                                                                     |
| NFR-11 | Documented scaling approach     |  0% |  0% |  0% |  0% |  5% | Note in plan: rate-limit store → Redis/HyperDB for multi-process      |
| NFR-12 | Failure scenarios + resilience  |  0% |  5% |  5% | 15% | 25% | Constant-time hash compare; revoked-key path covered                  |
| NFR-13 | TypeScript / type safety        | 75% | 90% | 90% | 95% | 95% | Typed accessors + augmented FastifyRequest.apiKey                     |
| NFR-14 | Logging / observability         |  0% |  0% | 40% | 45% | 50% | Domain-error / rate-limit warn logs                                   |

## Deliverables (DEL)

| ID     | Requirement                                |   S1 |   S2 |   S3 |  S4a |  S4b | Notes                                   |
| ------ | ------------------------------------------ | ---: | ---: | ---: | ---: | ---: | --------------------------------------- |
| DEL-01 | GitHub repo + README + setup               |  50% |  50% |  50% |  50% |  50% | Polish in Step 12                       |
| DEL-02 | Live demo URL (bonus)                      |   0% |   0% |   0% |   0% |   0% | —                                       |
| DEL-03 | OpenAPI spec                               |   0% |  15% |  50% |  50% |  65% | api-keys endpoints + Bearer scheme live |
| DEL-04 | Architecture document                      |   0% |   0% |   0% |   0% |   0% | —                                       |
| DEL-05 | Demo video (≤5 min)                        |   0% |   0% |   0% |   0% |   0% | —                                       |
| DEL-06 | Folder structure (backend/frontend/shared) | 100% | 100% | 100% | 100% | 100% | ✅ Done                                 |
| DEL-07 | Docker Compose setup                       |   0% |   0% |   0% |   0% |   0% | Step 6.5                                |
| DEL-08 | `.env.example`                             | 100% | 100% | 100% | 100% | 100% | ✅ Done; STATE_BACKEND added            |
| DEL-09 | Basic test coverage                        |  25% |  35% |  45% |  55% |  70% | 75 tests across shared + backend        |
| DEL-10 | CI/CD pipeline                             |   0% |   0% |   0% |   0% |   0% | Step 6.5                                |

---

## Aggregate Progress

| Bucket                              |       S1 |       S2 |       S3 |      S4a |      S4b |
| ----------------------------------- | -------: | -------: | -------: | -------: | -------: |
| Functional Requirements (FR, 13)    |       0% |      ~8% |     ~13% |     ~16% |     ~30% |
| Tech Stack (TS, 3)                  |      25% |     ~38% |     ~47% |     ~57% |     ~63% |
| Non-Functional (NFR, 14)            |     ~14% |     ~18% |     ~30% |     ~36% |     ~42% |
| Deliverables (DEL, 10)              |   ~32.5% |     ~35% |   ~39.5% |   ~40.5% |     ~45% |
| **Overall (40 items, simple mean)** | **~13%** | **~18%** | **~25%** | **~30%** | **~40%** |

---

## Step-by-step changelog

### Step 1 — Tooling and Type System

- TypeScript strict mode wired across all packages (`tsconfig.base.json` + per-package overrides).
- ESLint v9 flat config with `typescript-eslint` and Prettier integration.
- Vitest workspace runs every suite via `pnpm test:run`.
- Seed test validates the toolchain.
- Result: senior-grade developer ergonomics in place.

### Step 2 — Shared Contracts

- 6 TypeBox HTTP DTO modules + 3 Compact Encoding RPC schemas + helper combinators (`defineObject`, `array`, `optional`, `taggedUnion`).
- Ambient `compact-encoding.d.ts`.
- Shared constants (HTTP, P2P discovery topic, HyperDB key prefixes, RPC method names).
- `ERROR_CODE` union for end-to-end error pattern matching.
- 14 unit tests.
- Result: every later step inherits typed, validated contracts.

### Step 3 — Backend Scaffold

- `buildApp()` factory + `server.ts` entrypoint with graceful SIGINT / SIGTERM shutdown.
- Plugins (via `fastify-plugin`): helmet, cors, swagger, request-id, error-handler.
- envalid loader → typed `BackendConfig` + `app.config` decoration.
- `DomainError` base class + `isDomainError`.
- Routes: `GET /health`, `GET /v1/models` (hardcoded mock-llm).
- Pino structured logging with `pino-pretty` in dev; UUID v7 request ids.
- 7 new `app.inject`-based tests (3 health + 1 models + 3 error-handler). Total now **21 / 21**.

### Step 4a — State Bootstrap

- `KvStore` interface (`ready / close / get / put / del / list`) with two adapters:
  - `InMemoryKvStore` (Map-backed; deep-cloned values; for tests + ephemeral dev).
  - `HyperbeeKvStore` (Hyperbee on Hypercore on disk; production default).
- Factory selects via `STATE_BACKEND` env var; auto-defaults to `memory` when `NODE_ENV=test`.
- Identity layer: `loadOrGenerateIdentity` (32-byte key persisted at `NODE_KEYPAIR_PATH`) + `createEphemeralIdentity` (in-memory only).
- Typed accessors: `ApiKeysState` (CRUD + `findByHash` + `revoke`), `WorkersState`, `JobsState` (with `transition`), `UsageState` (with `incrementCounter`).
- `bootstrapState()` orchestrator + `state.plugin.ts` Fastify integration; `app.state` decoration; `onClose` hook for graceful shutdown.
- Ambient `hyperbee.d.ts` and `hypercore.d.ts` declarations.
- 15 new tests: 5 in-memory adapter, 6 api-keys state, 4 identity. Total now **36 / 36**.
- Mechanical static-analysis fixes: TS4114 fix for `StateError` (use `super(message, { cause })`), removed unused `eslint-disable-next-line` directives.
- Result: every later feature has a typed, swappable persistence layer behind `app.state`.

### Step 4b — API keys + auth + rate limiting

- Crypto helpers (`apps/backend/src/auth/api-key.crypto.ts`): `sk-`-prefixed plaintext generator, HMAC-SHA-256 hex hashing, `extractPrefix`, `safeHashEqual` (constant-time, equal-length-safe), and a `parseBearer` that distinguishes `apiKeyMissing` (401) from `apiKeyInvalid` (401).
- `ApiKeysService` (`apps/backend/src/services/api-keys.service.ts`) composes `ApiKeysState` + crypto. `create` returns plaintext exactly once; `list` projects to a public-safe DTO sorted desc by `createdAt`; `revoke` throws `apiKeyNotFound` for unknown ids and is idempotent on already-revoked records; `authenticatePlaintext` distinguishes invalid (401) from revoked (403).
- `auth.plugin.ts` decorates `app.apiKeys` and `app.authenticate` (a `preHandler`) and augments `FastifyRequest.apiKey` for downstream handlers.
- `rate-limit.plugin.ts` wraps `@fastify/rate-limit` with a `keyGenerator` that buckets by bearer token (when present) and falls back to remote IP, so anonymous and authenticated traffic share isolated buckets.
- Central error handler now maps `error.statusCode === 429` into `ApiErrorBody { code: rateLimited }`, keeping the response envelope consistent across the API surface.
- `apiKeysRoute` exposes `POST/GET/DELETE /v1/api-keys` with TypeBox-validated bodies/params and Swagger-documented responses; DELETE returns 204 on success and 404 with `apiKeyNotFound` via the central error handler.
- `health` and `models` routes opt out of rate limiting via `config: { rateLimit: false }`.
- 39 new tests: 18 crypto, 9 service, 5 auth-plugin (happy path + 4 rejection branches), 3 rate-limit plugin (429 envelope, per-key isolation, /health opt-out), 4 routes. Total now **75 / 75**.
- Result: API key lifecycle, Bearer auth, and per-key rate limiting are production-shaped and ready to be applied as a `preHandler` on the inference routes in Step 6.

### Step 5 — Worker runtime (next)

_Pending._
