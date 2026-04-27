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

| ID    | Requirement                                | Pre-S1 | After S1 | After S2 | After S3 | Notes                                  |
| ----- | ------------------------------------------ | -----: | -------: | -------: | -------: | -------------------------------------- |
| FR-01 | Backend manages API keys (CRUD)            |     0% |       0% |      10% |      10% | DTOs defined; routes land Step 4b      |
| FR-02 | Backend handles inference requests         |     0% |       0% |      10% |      10% | RPC schemas defined; routing Step 6    |
| FR-03 | Backend simulates workload distribution    |     0% |       0% |       0% |       0% | —                                      |
| FR-04 | P2P / distributed task queue               |     0% |       0% |       5% |       5% | Constants; runtime in Step 5/6         |
| FR-05 | Frontend — API key management UI           |     0% |       0% |       5% |       5% | Shared DTOs available                  |
| FR-06 | Frontend — usage monitoring UI             |     0% |       0% |       5% |       5% | Usage DTO defined                      |
| FR-07 | Frontend — basic model deployment workflow |     0% |       0% |       5% |       5% | Model DTO defined                      |
| FR-08 | OpenAI-compatible streaming endpoint       |     0% |       0% |      15% |      15% | Chunk DTO + SSE constants              |
| FR-09 | OpenAI-compatible non-streaming endpoint   |     0% |       0% |      15% |      15% | ChatCompletion DTO defined             |
| FR-10 | Usage tracking                             |     0% |       0% |       5% |       5% | UsageSummary DTO defined               |
| FR-11 | Rate limiting                              |     0% |       0% |       5% |       5% | `RateLimited` error code defined       |
| FR-12 | Metrics dashboard                          |     0% |       0% |       0% |       0% | —                                      |
| FR-13 | Health check endpoint                      |     0% |       0% |      10% |      75% | Live `GET /health` + tests             |

## Tech Stack Adherence (TS)

| ID    | Requirement                    | Pre-S1 | After S1 | After S2 | After S3 | Notes                                                    |
| ----- | ------------------------------ | -----: | -------: | -------: | -------: | -------------------------------------------------------- |
| TS-01 | Node.js + Fastify backend      |    25% |      25% |      40% |      65% | Fastify booting with full plugin stack                   |
| TS-02 | Hyperswarm RPC / Hyperswarm    |    25% |      25% |      40% |      40% | RPC schemas only; runtime in Steps 5–6                   |
| TS-03 | HyperDB (or similar K/V store) |    25% |      25% |      35% |      35% | Namespace prefix constants only                          |

## Non-Functional / Best Practices (NFR)

| ID     | Requirement                     | Pre-S1 | After S1 | After S2 | After S3 | Notes                                                  |
| ------ | ------------------------------- | -----: | -------: | -------: | -------: | ------------------------------------------------------ |
| NFR-01 | Clean modular architecture      |    25% |      50% |      60% |      70% | Plugin-per-concern + factory pattern                   |
| NFR-02 | Proper error handling           |     0% |       0% |      15% |      50% | Central error handler + DomainError + tests            |
| NFR-03 | Input validation                |     0% |       0% |      25% |      40% | TypeBox provider wired into routes                     |
| NFR-04 | Env-var configuration           |    50% |      50% |      50% |      75% | envalid loader implemented + typed                     |
| NFR-05 | Async patterns / resource mgmt  |     0% |       0% |       0% |      30% | Async handlers + graceful SIGINT/SIGTERM shutdown      |
| NFR-06 | Frontend responsive             |     0% |       0% |       0% |       0% | —                                                      |
| NFR-07 | Frontend state management       |     0% |       0% |       0% |       0% | —                                                      |
| NFR-08 | Frontend real-time updates      |     0% |       0% |       0% |       0% | —                                                      |
| NFR-09 | Frontend loading / error states |     0% |       0% |       0% |       0% | —                                                      |
| NFR-10 | Local distributed simulation    |     0% |       0% |       0% |       0% | —                                                      |
| NFR-11 | Documented scaling approach     |     0% |       0% |       0% |       0% | —                                                      |
| NFR-12 | Failure scenarios + resilience  |     0% |       0% |       5% |       5% | Cancellation/timeout codes defined                     |
| NFR-13 | TypeScript / type safety        |    25% |      75% |      90% |      90% | Strict mode + nodenext; backend uses TypeBox provider  |
| NFR-14 | Logging / observability         |     0% |       0% |       0% |      40% | Pino + request-id propagation working                  |

## Deliverables (DEL)

| ID     | Requirement                                | Pre-S1 | After S1 | After S2 | After S3 | Notes                                   |
| ------ | ------------------------------------------ | -----: | -------: | -------: | -------: | --------------------------------------- |
| DEL-01 | GitHub repo + README + setup               |    50% |      50% |      50% |      50% | Polish in Step 12                       |
| DEL-02 | Live demo URL (bonus)                      |     0% |       0% |       0% |       0% | —                                       |
| DEL-03 | OpenAPI spec                               |     0% |       0% |      15% |      50% | Swagger UI live at `/docs` (2 routes)   |
| DEL-04 | Architecture document                      |     0% |       0% |       0% |       0% | —                                       |
| DEL-05 | Demo video (≤5 min)                        |     0% |       0% |       0% |       0% | —                                       |
| DEL-06 | Folder structure (backend/frontend/shared) |   100% |     100% |     100% |     100% | ✅ Done                                  |
| DEL-07 | Docker Compose setup                       |     0% |       0% |       0% |       0% | Step 6.5                                |
| DEL-08 | `.env.example`                             |   100% |     100% |     100% |     100% | ✅ Done                                  |
| DEL-09 | Basic test coverage                        |     0% |      25% |      35% |      45% | 21 tests across shared + backend        |
| DEL-10 | CI/CD pipeline                             |     0% |       0% |       0% |       0% | Step 6.5                                |

---

## Aggregate Progress

| Bucket                              | Pre-S1  | After S1 | After S2 | After S3 |
| ----------------------------------- | ------: | -------: | -------: | -------: |
| Functional Requirements (FR, 13)    |      0% |       0% |      ~8% |     ~13% |
| Tech Stack (TS, 3)                  |     25% |      25% |     ~38% |     ~47% |
| Non-Functional (NFR, 14)            |     ~7% |     ~14% |     ~18% |     ~30% |
| Deliverables (DEL, 10)              |    ~30% |   ~32.5% |     ~35% |    ~39.5% |
| **Overall (40 items, simple mean)** | **~9%** | **~13%** | **~18%** | **~25%** |

---

## Step-by-step changelog

### Step 1 — Tooling and Type System

- TypeScript strict mode wired across all packages (`tsconfig.base.json` + per-package overrides).
- ESLint v9 flat config with `typescript-eslint` and Prettier integration.
- Vitest workspace runs every suite via `pnpm test:run`.
- Seed test validates the toolchain.
- Result: senior-grade developer ergonomics in place; all subsequent steps inherit strict typing and consistent style.

### Step 2 — Shared Contracts

- 6 TypeBox HTTP DTO modules (api-key, chat-completion, usage, model, health, error envelope) with `Static<>` derived TS types.
- 3 Compact Encoding RPC schemas (inference request, inference response tagged union, worker health) with helper combinators (`defineObject`, `array`, `optional`, `taggedUnion`) and an ambient `compact-encoding.d.ts` for typing.
- Shared constants for HTTP, P2P discovery topic, HyperDB key prefixes, RPC method names.
- Shared `ERROR_CODE` union for end-to-end error pattern matching.
- 14 unit tests: 8 codec round-trip cases + 6 TypeBox `Value.Check` validation cases.
- Result: every later step inherits typed, validated contracts via `@cosmic/shared/*`.

### Step 3 — Backend Scaffold

- `buildApp()` factory + `server.ts` entrypoint with graceful SIGINT / SIGTERM shutdown.
- Plugins (each via `fastify-plugin`): `helmet` (CSP off for `/docs`), `cors` (allow-listed `FRONTEND_ORIGIN`), `swagger` + `swagger-ui` (OpenAPI 3.1 + `apiKey` security scheme), `request-id` (echoes header), `error-handler` (maps `DomainError` / validation / unknown → `ApiErrorBody`).
- `envalid` loader (`loadConfig`) returning a typed `BackendConfig`; decorated as `app.config`.
- `DomainError` base class + `isDomainError` type guard.
- Routes: `GET /health` (returns `HealthResponse`), `GET /v1/models` (hardcoded `mock-llm`).
- Pino structured logging with `pino-pretty` in dev; UUID v7 request ids generated when absent.
- 7 new tests (3 health + 1 models + 3 error-handler) using `app.inject`. Total now 21 / 21 passing.
- Result: backend boots, serves Swagger UI at `/docs`, and gives every later route a typed/validated/documented contract.

### Step 4a — State Bootstrap (next)

_Pending._
