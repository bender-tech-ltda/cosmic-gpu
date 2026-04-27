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

| ID    | Requirement                                | Pre-S1 | After S1 | After S2 | Notes                               |
| ----- | ------------------------------------------ | -----: | -------: | -------: | ----------------------------------- |
| FR-01 | Backend manages API keys (CRUD)            |     0% |       0% |      10% | DTOs defined                        |
| FR-02 | Backend handles inference requests         |     0% |       0% |      10% | RPC schemas defined                 |
| FR-03 | Backend simulates workload distribution    |     0% |       0% |       0% | —                                   |
| FR-04 | P2P / distributed task queue               |     0% |       0% |       5% | RPC method names + payload schemas  |
| FR-05 | Frontend — API key management UI           |     0% |       0% |       5% | Shared DTOs available               |
| FR-06 | Frontend — usage monitoring UI             |     0% |       0% |       5% | Usage DTO defined                   |
| FR-07 | Frontend — basic model deployment workflow |     0% |       0% |       5% | Model DTO defined                   |
| FR-08 | OpenAI-compatible streaming endpoint       |     0% |       0% |      15% | ChatCompletionChunk + SSE constants |
| FR-09 | OpenAI-compatible non-streaming endpoint   |     0% |       0% |      15% | ChatCompletion DTO defined          |
| FR-10 | Usage tracking                             |     0% |       0% |       5% | UsageSummary DTO defined            |
| FR-11 | Rate limiting                              |     0% |       0% |       5% | `RateLimited` error code defined    |
| FR-12 | Metrics dashboard                          |     0% |       0% |       0% | —                                   |
| FR-13 | Health check endpoint                      |     0% |       0% |      10% | HealthResponse DTO defined          |

## Tech Stack Adherence (TS)

| ID    | Requirement                    | Pre-S1 | After S1 | After S2 | Notes                                              |
| ----- | ------------------------------ | -----: | -------: | -------: | -------------------------------------------------- |
| TS-01 | Node.js + Fastify backend      |    25% |      25% |      40% | DTOs ready for Fastify routes                      |
| TS-02 | Hyperswarm RPC / Hyperswarm    |    25% |      25% |      40% | RPC method names + Compact Encoding payloads ready |
| TS-03 | HyperDB (or similar K/V store) |    25% |      25% |      35% | Namespace prefix constants defined                 |

## Non-Functional / Best Practices (NFR)

| ID     | Requirement                     | Pre-S1 | After S1 | After S2 | Notes                                           |
| ------ | ------------------------------- | -----: | -------: | -------: | ----------------------------------------------- |
| NFR-01 | Clean modular architecture      |    25% |      50% |      60% | Shared package now has real boundaries          |
| NFR-02 | Proper error handling           |     0% |       0% |      15% | ApiErrorBody envelope + ERROR_CODE union        |
| NFR-03 | Input validation                |     0% |       0% |      25% | TypeBox schemas exist; runtime check in Step 3+ |
| NFR-04 | Env-var configuration           |    50% |      50% |      50% | Loader still in Step 3                          |
| NFR-05 | Async patterns / resource mgmt  |     0% |       0% |       0% | —                                               |
| NFR-06 | Frontend responsive             |     0% |       0% |       0% | —                                               |
| NFR-07 | Frontend state management       |     0% |       0% |       0% | —                                               |
| NFR-08 | Frontend real-time updates      |     0% |       0% |       0% | —                                               |
| NFR-09 | Frontend loading / error states |     0% |       0% |       0% | —                                               |
| NFR-10 | Local distributed simulation    |     0% |       0% |       0% | —                                               |
| NFR-11 | Documented scaling approach     |     0% |       0% |       0% | —                                               |
| NFR-12 | Failure scenarios + resilience  |     0% |       0% |       5% | Cancellation/timeout codes defined              |
| NFR-13 | TypeScript / type safety        |    25% |      75% |      90% | Real shared types & schemas in use              |
| NFR-14 | Logging / observability         |     0% |       0% |       0% | —                                               |

## Deliverables (DEL)

| ID     | Requirement                                | Pre-S1 | After S1 | After S2 | Notes                          |
| ------ | ------------------------------------------ | -----: | -------: | -------: | ------------------------------ |
| DEL-01 | GitHub repo + README + setup               |    50% |      50% |      50% | Polish in Step 12              |
| DEL-02 | Live demo URL (bonus)                      |     0% |       0% |       0% | —                              |
| DEL-03 | OpenAPI spec                               |     0% |       0% |      15% | TypeBox schemas swagger-ready  |
| DEL-04 | Architecture document                      |     0% |       0% |       0% | —                              |
| DEL-05 | Demo video (≤5 min)                        |     0% |       0% |       0% | —                              |
| DEL-06 | Folder structure (backend/frontend/shared) |   100% |     100% |     100% | ✅ Done                        |
| DEL-07 | Docker Compose setup                       |     0% |       0% |       0% | —                              |
| DEL-08 | `.env.example`                             |   100% |     100% |     100% | ✅ Done                        |
| DEL-09 | Basic test coverage                        |     0% |      25% |      35% | 14 tests across schemas + DTOs |
| DEL-10 | CI/CD pipeline                             |     0% |       0% |       0% | —                              |

---

## Aggregate Progress

| Bucket                              |  Pre-S1 | After S1 | After S2 |
| ----------------------------------- | ------: | -------: | -------: |
| Functional Requirements (FR, 13)    |      0% |       0% |      ~8% |
| Tech Stack (TS, 3)                  |     25% |      25% |     ~38% |
| Non-Functional (NFR, 14)            |     ~7% |     ~14% |     ~18% |
| Deliverables (DEL, 10)              |    ~30% |   ~32.5% |     ~35% |
| **Overall (40 items, simple mean)** | **~9%** | **~13%** | **~18%** |

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

### Step 3 — Backend Scaffold (next)

_Pending._
