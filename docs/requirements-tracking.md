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

| ID    | Requirement                                |  S1 |  S2 |  S3 | S4a |  S4b |   CP |   S5 | Notes                                                                    |
| ----- | ------------------------------------------ | --: | --: | --: | --: | ---: | ---: | ---: | ------------------------------------------------------------------------ |
| FR-01 | Backend manages API keys (CRUD)            |  0% | 10% | 10% | 25% | 100% | 100% | 100% | Audit events emitted on create + revoke                                  |
| FR-02 | Backend handles inference requests         |  0% | 10% | 10% | 10% |  10% |  10% |  40% | Worker exposes `inference.run` over Hyperswarm RPC; backend wires Step 6 |
| FR-03 | Backend simulates workload distribution    |  0% |  0% |  0% | 10% |  10% |  10% |  35% | Worker process joins swarm with stable keypair; mock-LLM in place        |
| FR-04 | P2P / distributed task queue               |  0% |  5% |  5% | 15% |  15% |  20% |  40% | Worker swarm join + RPC server live; queue logic comes with dispatcher   |
| FR-05 | Frontend — API key management UI           |  0% |  5% |  5% |  5% |  10% |  10% |  10% | Backend endpoints ready to consume                                       |
| FR-06 | Frontend — usage monitoring UI             |  0% |  5% |  5% |  5% |   5% |   5% |   5% | Usage DTO defined                                                        |
| FR-07 | Frontend — basic model deployment workflow |  0% |  5% |  5% |  5% |   5% |   5% |   5% | Model DTO defined                                                        |
| FR-08 | OpenAI-compatible streaming endpoint       |  0% | 15% | 15% | 15% |  15% |  20% |  35% | `streamInference` handler unit-tested end-to-end; Protomux wiring Step 7 |
| FR-09 | OpenAI-compatible non-streaming endpoint   |  0% | 15% | 15% | 15% |  20% |  20% |  40% | Worker side complete; backend route lands Step 6                         |
| FR-10 | Usage tracking                             |  0% |  5% |  5% | 25% |  25% |  25% |  25% | UsageState accessor + windows logic                                      |
| FR-11 | Rate limiting                              |  0% |  5% |  5% |  5% | 100% |  90% |  90% | Behaviour at 100%; trade-off documented in `docs/architecture.md`        |
| FR-12 | Metrics dashboard                          |  0% |  0% |  0% |  0% |   0% |   0% |   0% | —                                                                        |
| FR-13 | Health check endpoint                      |  0% | 10% | 75% | 75% |  80% |  80% |  85% | `worker.health` snapshot + codec round-trip                              |

## Tech Stack Adherence (TS)

| ID    | Requirement                    |  S1 |  S2 |  S3 | S4a | S4b |  CP |  S5 | Notes                                                     |
| ----- | ------------------------------ | --: | --: | --: | --: | --: | --: | --: | --------------------------------------------------------- |
| TS-01 | Node.js + Fastify backend      | 25% | 40% | 65% | 65% | 80% | 85% | 85% | No backend changes in S5                                  |
| TS-02 | Hyperswarm RPC / Hyperswarm    | 25% | 40% | 40% | 40% | 40% | 50% | 75% | Worker joins Hyperswarm + answers `@hyperswarm/rpc` calls |
| TS-03 | HyperDB (or similar K/V store) | 25% | 35% | 35% | 65% | 70% | 75% | 75% | Unchanged                                                 |

## Non-Functional / Best Practices (NFR)

| ID     | Requirement                     |  S1 |  S2 |  S3 | S4a | S4b |  CP |  S5 | Notes                                                                |
| ------ | ------------------------------- | --: | --: | --: | --: | --: | --: | --: | -------------------------------------------------------------------- |
| NFR-01 | Clean modular architecture      | 50% | 60% | 70% | 80% | 85% | 88% | 90% | Worker split into config / runtime / handlers / simulator modules    |
| NFR-02 | Proper error handling           |  0% | 15% | 50% | 50% | 70% | 70% | 75% | Worker translates RPC failures into `inference.failed` audit events  |
| NFR-03 | Input validation                |  0% | 25% | 40% | 40% | 60% | 60% | 70% | RPC payloads validated by Compact Encoding decoders                  |
| NFR-04 | Env-var configuration           | 50% | 50% | 75% | 80% | 80% | 90% | 95% | Worker now has its own typed `WorkerConfig` loader                   |
| NFR-05 | Async patterns / resource mgmt  |  0% |  0% | 30% | 40% | 45% | 45% | 70% | Async generators + AbortSignal cancel; SIGINT/SIGTERM teardown order |
| NFR-06 | Frontend responsive             |  0% |  0% |  0% |  0% |  0% |  0% |  0% | —                                                                    |
| NFR-07 | Frontend state management       |  0% |  0% |  0% |  0% |  0% |  0% |  0% | —                                                                    |
| NFR-08 | Frontend real-time updates      |  0% |  0% |  0% |  0% |  0% |  0% |  0% | —                                                                    |
| NFR-09 | Frontend loading / error states |  0% |  0% |  0% |  0% |  0% |  0% |  0% | —                                                                    |
| NFR-10 | Local distributed simulation    |  0% |  0% |  0% |  0% |  0% | 50% | 65% | Worker container has a real entrypoint; Compose can boot the swarm   |
| NFR-11 | Documented scaling approach     |  0% |  0% |  0% |  0% |  5% | 60% | 60% | Unchanged                                                            |
| NFR-12 | Failure scenarios + resilience  |  0% |  5% |  5% | 15% | 25% | 35% | 50% | AbortSignal-aware mock LLM; in-flight discipline; cancellation tests |
| NFR-13 | TypeScript / type safety        | 75% | 90% | 90% | 95% | 95% | 95% | 95% | Typed Hyperswarm/RPC ambient declarations carry the runtime layer    |
| NFR-14 | Logging / observability         |  0% |  0% | 40% | 45% | 50% | 70% | 80% | Worker Pino with redact + `worker.joined`/`worker.left` audit events |

## Deliverables (DEL)

| ID     | Requirement                                |   S1 |   S2 |   S3 |  S4a |  S4b |   CP |   S5 | Notes                                                  |
| ------ | ------------------------------------------ | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ------------------------------------------------------ |
| DEL-01 | GitHub repo + README + setup               |  50% |  50% |  50% |  50% |  50% |  50% |  50% | README refresh queued as Step 5.5                      |
| DEL-02 | Live demo URL (bonus)                      |   0% |   0% |   0% |   0% |   0% |   0% |   0% | —                                                      |
| DEL-03 | OpenAPI spec                               |   0% |  15% |  50% |  50% |  65% |  65% |  65% | Unchanged                                              |
| DEL-04 | Architecture document                      |   0% |   0% |   0% |   0% |   0% |  75% |  78% | Worker runtime + transport split now reflected in code |
| DEL-05 | Demo video (≤5 min)                        |   0% |   0% |   0% |   0% |   0% |   0% |   0% | —                                                      |
| DEL-06 | Folder structure (backend/frontend/shared) | 100% | 100% | 100% | 100% | 100% | 100% | 100% | ✅ Done                                                |
| DEL-07 | Docker Compose setup                       |   0% |   0% |   0% |   0% |   0% |  60% |  70% | Worker image now has a real entrypoint                 |
| DEL-08 | `.env.example`                             | 100% | 100% | 100% | 100% | 100% | 100% | 100% | ✅ Done; WORKER*\* + MOCK_LLM*\* added                 |
| DEL-09 | Basic test coverage                        |  25% |  35% |  45% |  55% |  70% |  80% |  85% | 114 tests across shared + backend + worker             |
| DEL-10 | CI/CD pipeline                             |   0% |   0% |   0% |   0% |   0% |  75% |  75% | Unchanged                                              |

---

## Aggregate Progress

| Bucket                              |       S1 |       S2 |       S3 |      S4a |      S4b |       CP |       S5 |
| ----------------------------------- | -------: | -------: | -------: | -------: | -------: | -------: | -------: |
| Functional Requirements (FR, 13)    |       0% |      ~8% |     ~13% |     ~16% |     ~30% |     ~31% |     ~38% |
| Tech Stack (TS, 3)                  |      25% |     ~38% |     ~47% |     ~57% |     ~63% |     ~70% |     ~78% |
| Non-Functional (NFR, 14)            |     ~14% |     ~18% |     ~30% |     ~36% |     ~42% |     ~48% |     ~54% |
| Deliverables (DEL, 10)              |   ~32.5% |     ~35% |   ~39.5% |   ~40.5% |     ~45% |     ~61% |     ~62% |
| **Overall (40 items, simple mean)** | **~13%** | **~18%** | **~25%** | **~30%** | **~40%** | **~46%** | **~52%** |

> **CP = Pre-Step-5 Correction Pass.** Combined the Cursor + Warp + verdict suggestions into one pass: seed-derived ed25519 identity (real keypair), `docs/architecture.md`, GitHub Actions CI, Docker Compose with 1 backend + 3 workers, Pino redaction + explicit bodyLimit + audit-event helper, `BACKEND_BODY_LIMIT_BYTES` and `P2P_BOOTSTRAP` env, dropped unused `hyperdb`, Compact Encoding edge tests, locked the streaming transport choice in `.cursor/rules/p2p-architecture.mdc` and `docs/architecture.md`.

## Deliberate trade-offs

Full list lives in [`docs/architecture.md` §4](./architecture.md#4-trade-offs-and-deliberate-divergences). Summary:

- Plain Node.js, not Pear Runtime / Bare.
- Hyperbee on Hypercore, not HyperDB.
- Single-writer Hyperbee, not multi-peer replication.
- `POST/GET/DELETE /v1/api-keys` are public for the take-home demo.
- `@fastify/rate-limit` uses the default in-memory store (single-instance only).
- Mock LLM workers, not real model serving.
- Fixed-point float encoding (×1000) for `temperature` / `topP` over RPC.
- Mark & Sweep GC, Fork-ID truncate handling, and signed RPC results are deferred (see `docs/architecture.md` §6).
- Study-guide encryption phrasing corrected: Hyperswarm uses Noise (asymmetric handshake → symmetric session keys).

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

### Pre-Step-5 Correction Pass (CP)

Merged correction pass driven by [`.cursor/plans/llm-verdict-evaluation.md`](../.cursor/plans/llm-verdict-evaluation.md) (the third-model adjudication of the Cursor + Warp evaluations). Eight focused changes, ordered to communicate first, unblock Step 5 second, and ship deliverable scaffolding third:

- **Architecture document**: [`docs/architecture.md`](./architecture.md) covers system design, distributed approach, transport split (Hyperswarm RPC for `inference.run` + `worker.health`; Protomux substream over the encrypted Hyperswarm session for `inference.stream`), trade-offs, failure scenarios, scaling, and future improvements.
- **Identity** (`apps/backend/src/state/identity.ts`): persists a 32-byte ed25519 **seed**; the real `{ publicKey: 32B, secretKey: 64B }` pair is derived on each boot via `HyperDHT.keyPair(seed)` (libsodium `crypto_sign_seed_keypair`). Tests now cover seed-only on-disk shape, deterministic re-load, malformed JSON, missing seed field, and wrong-length seed.
- **Streaming transport rule update**: [`.cursor/rules/p2p-architecture.mdc`](../.cursor/rules/p2p-architecture.mdc) now documents the RPC vs Protomux split so the rule and the architecture doc agree.
- **CI**: `.github/workflows/ci.yml` runs lint → typecheck → test → build → format:check on Node 22 + pnpm 9 for every push to `main` and every pull request.
- **Docker scaffolding**: `docker/backend.Dockerfile`, `docker/worker.Dockerfile`, root `docker-compose.yml` with 1 backend + 3 workers, named volumes per worker, shared `P2P_DISCOVERY_TOPIC`, healthcheck on `/health`, `.dockerignore`. Multi-stage builds run as `USER node` on `node:22-bookworm-slim` (chosen over Alpine for native Holepunch bindings).
- **Backend hardening**: explicit Fastify `bodyLimit` driven by `BACKEND_BODY_LIMIT_BYTES` (default 1 MiB); Pino `redact` paths censor `authorization` headers, `body.messages[*].content`, and any `plaintext` field with `[REDACTED]`.
- **Audit-event helper** (`apps/backend/src/observability/audit.ts`): typed `AUDIT_EVENT` map + `logEvent()` helper now emits `event=api-key.created` and `event=api-key.revoked` from `ApiKeysService`. Auth plugin threads `app.log` into the service.
- **Wire forward**: dropped the unused `hyperdb` dependency; added `P2P_BOOTSTRAP` env to the typed config loader and `.env.example` for self-contained Compose runs.
- **Compact Encoding edge tests**: empty content, very long content (~64 KiB), multi-byte UTF-8 in delta and worker fields, all three `finishReason` variants, fixed-point precision, and zero/boundary token counts. Total now **92 / 92** tests (was 75).

### Step 5 — Worker runtime

- **Worker config** (`apps/worker/src/config/env.config.ts`): typed `WorkerConfig` from envalid — `WORKER_ID`, `WORKER_LOG_LEVEL`, `WORKER_HEARTBEAT_INTERVAL_MS`, `WORKER_CAPACITY`, `WORKER_MODEL_ID`, `MOCK_LLM_TOKEN_RATE_HZ`, `MOCK_LLM_MAX_TOKENS`, plus the shared `P2P_DISCOVERY_TOPIC` / `P2P_BOOTSTRAP` / `NODE_KEYPAIR_PATH` / `DATA_DIR`.
- **Worker identity** (`apps/worker/src/runtime/identity.ts`): mirror of the backend pattern — persists a 32-byte seed at `NODE_KEYPAIR_PATH`, derives `{ publicKey, secretKey }` via `HyperDHT.keyPair(seed)` on each boot. Tests cover seed-only on-disk shape, deterministic re-load, malformed JSON, missing seed, and wrong-length seed.
- **Mock LLM** (`apps/worker/src/simulator/mock-llm.ts`): deterministic synthetic token generator. mulberry32 PRNG seeded by SHA-256 of `jobId`; configurable `tokenRateHz` / `maxTokens`; honours an `AbortSignal` to terminate with `finishReason='cancelled'`. Sleep is dependency-injected so tests can pin the rate timing.
- **Handlers** (`apps/worker/src/handlers/`): `runInference` (non-streaming) and `streamInference` (async generator yielding `chunk` then `final`) both honour `AbortSignal` and use a small `inFlightCounter` so `worker.health` can advertise live load. `buildHealthSnapshot` is a pure function that round-trips through the `WorkerHealth` Compact Encoding codec.
- **Pino logger + audit events** (`apps/worker/src/observability/logger.ts`): standalone Pino instance with the same redact paths the backend uses; `WORKER_AUDIT_EVENT` map mirrors the backend's convention (`worker.joined`, `worker.left`, `inference.dispatched`, `inference.completed`, `inference.failed`).
- **Hyperswarm + RPC wiring** (`apps/worker/src/runtime/swarm.ts` + `rpc-server.ts`): joins the configured topic with the persisted keypair (passing optional `P2P_BOOTSTRAP`); registers `inference.run` and `worker.health` over `@hyperswarm/rpc` with the shared Compact Encoding codecs. Streaming (`inference.stream`) handler is in place and unit-tested; its Protomux transport binding is intentionally deferred to Step 7 (streaming SSE bridge) per the architecture doc §2.3.
- **Worker entrypoint** (`apps/worker/src/worker.ts`): replaces the placeholder `index.ts`. Wires config → identity → swarm → RPC server → graceful SIGINT/SIGTERM shutdown. Worker package now declares `hyperdht`, `protomux`, `b4a`, and `pino-pretty` as direct deps.
- **Ambient types** (`apps/worker/src/types/hyperdht.d.ts`): narrow declarations for `hyperdht`, `hyperswarm`, and `@hyperswarm/rpc` covering only the surface this app touches.
- **Tests**: 22 new (6 identity, 7 mock-llm, 6 inference + streaming, 3 health). Total now **114 / 114** (was 92).

### Step 5.5 — README refresh (next)

_Pending._ Refresh `README.md`, `apps/backend/README.md`, and `apps/worker/README.md` to reflect Hyperbee (not HyperDB), the actual `/v1/api-keys` endpoints (publicly accessible per take-home trade-off), the streaming transport split, and the new worker runtime layout.

### Step 6 — Backend dispatcher + non-streaming inference

_Pending._
