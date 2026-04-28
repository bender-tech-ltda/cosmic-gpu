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

| ID    | Requirement                                |  S1 |  S2 |  S3 | S4a |  S4b |   CP |   S5 |   S6 | S6.5 |   S7 |   S8 | Notes                                                                  |
| ----- | ------------------------------------------ | --: | --: | --: | --: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---------------------------------------------------------------------- |
| FR-01 | Backend manages API keys (CRUD)            |  0% | 10% | 10% | 25% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | Unchanged                                                              |
| FR-02 | Backend handles inference requests         |  0% | 10% | 10% | 10% |  10% |  10% |  40% |  85% |  85% |  90% |  92% | Dispatcher emits per-outcome metrics                                   |
| FR-03 | Backend simulates workload distribution    |  0% |  0% |  0% | 10% |  10% |  10% |  35% |  75% |  75% |  80% |  82% | Worker gauges (connected / capacity) surfaced via `/metrics`           |
| FR-04 | P2P / distributed task queue               |  0% |  5% |  5% | 15% |  15% |  20% |  40% |  80% |  85% |  90% |  90% | Unchanged                                                              |
| FR-05 | Frontend — API key management UI           |  0% |  5% |  5% |  5% |  10% |  10% |  10% |  10% |  10% |  10% |  10% | Unchanged                                                              |
| FR-06 | Frontend — usage monitoring UI             |  0% |  5% |  5% |  5% |   5% |   5% |   5% |   5% |   5% |   5% |  35% | `/v1/usage/me` JSON contract live; UI still pending                    |
| FR-07 | Frontend — basic model deployment workflow |  0% |  5% |  5% |  5% |   5% |   5% |   5% |   5% |   5% |   5% |   5% | Unchanged                                                              |
| FR-08 | OpenAI-compatible streaming endpoint       |  0% | 15% | 15% | 15% |  15% |  20% |  35% |  35% |  35% |  95% |  95% | Unchanged                                                              |
| FR-09 | OpenAI-compatible non-streaming endpoint   |  0% | 15% | 15% | 15% |  20% |  20% |  40% |  90% |  90% |  90% |  90% | Unchanged                                                              |
| FR-10 | Usage tracking                             |  0% |  5% |  5% | 25% |  25% |  25% |  25% |  55% |  55% |  60% |  85% | Per-key totals + windowed history exposed via `/v1/usage/me`           |
| FR-11 | Rate limiting                              |  0% |  5% |  5% |  5% | 100% |  90% |  90% |  90% |  90% |  90% |  92% | 429 envelopes also increment `metrics.rateLimit.rejections`            |
| FR-12 | Metrics dashboard                          |  0% |  0% |  0% |  0% |   0% |   0% |   0% |   0% |   0% |   0% |  60% | `/metrics` JSON live (counters / latency / worker gauges); UI deferred |
| FR-13 | Health check endpoint                      |  0% | 10% | 75% | 75% |  80% |  80% |  85% |  95% |  95% |  95% |  95% | Unchanged                                                              |

## Tech Stack Adherence (TS)

| ID    | Requirement                    |  S1 |  S2 |  S3 | S4a | S4b |  CP |  S5 |  S6 | S6.5 |  S7 |  S8 | Notes                                                                 |
| ----- | ------------------------------ | --: | --: | --: | --: | --: | --: | --: | --: | ---: | --: | --: | --------------------------------------------------------------------- |
| TS-01 | Node.js + Fastify backend      | 25% | 40% | 65% | 65% | 80% | 85% | 85% | 90% |  90% | 92% | 94% | Telemetry plugin + `/metrics` + `/v1/usage/me` routes                 |
| TS-02 | Hyperswarm RPC / Hyperswarm    | 25% | 40% | 40% | 40% | 40% | 50% | 75% | 90% |  92% | 95% | 95% | Unchanged                                                             |
| TS-03 | HyperDB (or similar K/V store) | 25% | 35% | 35% | 65% | 70% | 75% | 75% | 80% |  80% | 80% | 82% | `UsageState.listForKey` aggregated by `/v1/usage/me` over Hyperbee KV |

## Non-Functional / Best Practices (NFR)

| ID     | Requirement                     |  S1 |  S2 |  S3 | S4a | S4b |  CP |  S5 |  S6 | S6.5 |  S7 |  S8 | Notes                                                               |
| ------ | ------------------------------- | --: | --: | --: | --: | --: | --: | --: | --: | ---: | --: | --: | ------------------------------------------------------------------- |
| NFR-01 | Clean modular architecture      | 50% | 60% | 70% | 80% | 85% | 88% | 90% | 92% |  92% | 93% | 94% | MetricsRegistry isolated behind a Fastify decorator + plugin        |
| NFR-02 | Proper error handling           |  0% | 15% | 50% | 50% | 70% | 70% | 75% | 85% |  85% | 88% | 90% | 429 envelopes track in `/metrics` so silent regressions are visible |
| NFR-03 | Input validation                |  0% | 25% | 40% | 40% | 60% | 60% | 70% | 80% |  80% | 80% | 82% | Metrics + usage routes use TypeBox response schemas                 |
| NFR-04 | Env-var configuration           | 50% | 50% | 75% | 80% | 80% | 90% | 95% | 95% |  95% | 95% | 95% | Unchanged                                                           |
| NFR-05 | Async patterns / resource mgmt  |  0% |  0% | 30% | 40% | 45% | 45% | 70% | 80% |  80% | 90% | 90% | Unchanged                                                           |
| NFR-06 | Frontend responsive             |  0% |  0% |  0% |  0% |  0% |  0% |  0% |  0% |   0% |  0% |  0% | —                                                                   |
| NFR-07 | Frontend state management       |  0% |  0% |  0% |  0% |  0% |  0% |  0% |  0% |   0% |  0% |  0% | —                                                                   |
| NFR-08 | Frontend real-time updates      |  0% |  0% |  0% |  0% |  0% |  0% |  0% |  0% |   0% |  0% |  0% | —                                                                   |
| NFR-09 | Frontend loading / error states |  0% |  0% |  0% |  0% |  0% |  0% |  0% |  0% |   0% |  0% |  0% | —                                                                   |
| NFR-10 | Local distributed simulation    |  0% |  0% |  0% |  0% |  0% | 50% | 65% | 75% |  90% | 90% | 90% | Unchanged                                                           |
| NFR-11 | Documented scaling approach     |  0% |  0% |  0% |  0% |  5% | 60% | 60% | 65% |  70% | 70% | 75% | Architecture §4.2 documents telemetry trade-offs                    |
| NFR-12 | Failure scenarios + resilience  |  0% |  5% |  5% | 15% | 25% | 35% | 50% | 70% |  70% | 80% | 80% | Unchanged                                                           |
| NFR-13 | TypeScript / type safety        | 75% | 90% | 90% | 95% | 95% | 95% | 95% | 95% |  95% | 95% | 95% | Unchanged                                                           |
| NFR-14 | Logging / observability         |  0% |  0% | 40% | 45% | 50% | 70% | 80% | 85% |  85% | 87% | 92% | Counters / latency percentiles / worker gauges live at `/metrics`   |

## Deliverables (DEL)

| ID     | Requirement                                |   S1 |   S2 |   S3 |  S4a |  S4b |   CP |   S5 |   S6 | S6.5 |   S7 |   S8 | Notes                                                  |
| ------ | ------------------------------------------ | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ------------------------------------------------------ |
| DEL-01 | GitHub repo + README + setup               |  50% |  50% |  50% |  50% |  50% |  50% |  50% |  50% |  65% |  65% |  70% | Backend README endpoint table updated for telemetry    |
| DEL-02 | Live demo URL (bonus)                      |   0% |   0% |   0% |   0% |   0% |   0% |   0% |   0% |   0% |   0% |   0% | —                                                      |
| DEL-03 | OpenAPI spec                               |   0% |  15% |  50% |  50% |  65% |  65% |  65% |  78% |  78% |  82% |  86% | Telemetry + Usage routes documented in Swagger         |
| DEL-04 | Architecture document                      |   0% |   0% |   0% |   0% |   0% |  75% |  78% |  82% |  85% |  88% |  90% | Telemetry section §4.2 added                           |
| DEL-05 | Demo video (≤5 min)                        |   0% |   0% |   0% |   0% |   0% |   0% |   0% |   0% |   0% |   0% |   0% | —                                                      |
| DEL-06 | Folder structure (backend/frontend/shared) | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | ✅ Done                                                |
| DEL-07 | Docker Compose setup                       |   0% |   0% |   0% |   0% |   0% |  60% |  70% |  80% |  95% |  95% |  95% | Unchanged                                              |
| DEL-08 | `.env.example`                             | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | ✅ Done                                                |
| DEL-09 | Basic test coverage                        |  25% |  35% |  45% |  55% |  70% |  80% |  85% |  90% |  90% |  92% |  93% | 153 tests across shared + backend + worker (+17 in S8) |
| DEL-10 | CI/CD pipeline                             |   0% |   0% |   0% |   0% |   0% |  75% |  75% |  75% |  90% |  90% |  90% | Unchanged                                              |

---

## Aggregate Progress

| Bucket                              |       S1 |       S2 |       S3 |      S4a |      S4b |       CP |       S5 |       S6 |     S6.5 |       S7 |       S8 |
| ----------------------------------- | -------: | -------: | -------: | -------: | -------: | -------: | -------: | -------: | -------: | -------: | -------: |
| Functional Requirements (FR, 13)    |       0% |      ~8% |     ~13% |     ~16% |     ~30% |     ~31% |     ~38% |     ~50% |     ~51% |     ~57% |     ~66% |
| Tech Stack (TS, 3)                  |      25% |     ~38% |     ~47% |     ~57% |     ~63% |     ~70% |     ~78% |     ~87% |     ~89% |     ~91% |     ~91% |
| Non-Functional (NFR, 14)            |     ~14% |     ~18% |     ~30% |     ~36% |     ~42% |     ~48% |     ~54% |     ~59% |     ~60% |     ~64% |     ~66% |
| Deliverables (DEL, 10)              |   ~32.5% |     ~35% |   ~39.5% |   ~40.5% |     ~45% |     ~61% |     ~62% |     ~67% |     ~73% |     ~74% |     ~76% |
| **Overall (40 items, simple mean)** | **~13%** | **~18%** | **~25%** | **~30%** | **~40%** | **~46%** | **~52%** | **~60%** | **~62%** | **~67%** | **~71%** |

> **CP = Pre-Step-5 Correction Pass.** Combined the Cursor + Warp + verdict suggestions into one pass.
> **S6 = Backend dispatcher + non-streaming inference.** Backend joins Hyperswarm, registry polls `worker.health`, dispatcher selects via least-in-flight + 1 retry, `POST /v1/chat/completions` is live.
> **S6.5 = Smoke Compose + CI.** Opt-in `p2p-local` profile with a HyperDHT bootstrap container, README smoke run section, CI `docker:build` matrix.
> **S7 = Streaming SSE inference.** Backend SSE bridge with backpressure + `AbortController` on client disconnect; worker Protomux stream-channel server.
> **S8 = Telemetry, `/metrics` and `/v1/usage/me`.** In-memory `MetricsRegistry`, public JSON metrics scrape, authenticated per-key usage summary, dispatcher + error-handler instrumentation.

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

### Step 5.5 — README refresh

- Root `README.md`, `apps/backend/README.md`, and `apps/worker/README.md` brought back in sync with Steps 4a/4b/CP/5: Hyperbee instead of HyperDB; the actual `/v1/api-keys` endpoints (publicly accessible per take-home trade-off); the Hyperswarm RPC vs Protomux streaming transport split; the new worker runtime layout (`config/`, `runtime/`, `simulator/`, `observability/`, `types/`).

### Step 6 — Backend dispatcher + non-streaming inference

- **Schema evolution.** Appended optional `text?: string` to `InferenceResponseFinal` (append-only policy preserved). Worker handler populates it from the mock LLM. Two new round-trip tests in `packages/shared`.
- **Backend P2P module** (`apps/backend/src/p2p/`):
  - `swarm.ts` joins the Hyperswarm topic with the persisted backend keypair, honouring `P2P_BOOTSTRAP`.
  - `rpc-client.ts` wraps `@hyperswarm/rpc` behind a small `RpcClient` interface so the dispatcher is unit-testable with a stub.
  - `registry.ts` listens on `swarm.on('connection')`, polls `worker.health` per peer, soft-removes after 3 consecutive failed polls, upserts records in `WorkersState`.
  - `dispatcher.ts` selects via least-in-flight (combined `inFlight + localPending`, stable random tiebreak), records `pending→dispatched→running→complete│failed` in `JobsState`, re-dispatches **once** on RPC failure, throws `503 noWorkersAvailable` / `503 workerTimeout` via `DomainError`, emits `inference.dispatched / completed / failed` audit events.
  - `index.ts` orchestrates the pieces and exposes a single `close()`.
- **Plugin + route**: `plugins/p2p.plugin.ts` decorates `app.p2p`. `routes/chat-completions.route.ts` exposes `POST /v1/chat/completions` (auth required, TypeBox-validated body, `stream:true` returns 400 ValidationFailed until Step 7), maps the worker's `InferenceResponseFinal` to OpenAI's `ChatCompletion`, and increments per-key `UsageState` counters per success.
- **Updated routes**: `/health` reads live peer count via `app.p2p?.registry.size()`. `/v1/models` projects `WorkerRecord.modelId`s when the registry has workers; falls back to `mock-llm` otherwise.
- **Wiring**: `app.ts` registers `p2pPlugin` after auth + rate-limit (skipped in tests via `NODE_ENV !== 'test'` so the test harness can stub `app.p2p`). Backend now declares `hyperswarm`, `protomux`, `b4a` as direct deps; ambient declarations extended.
- **Tests**: 6 dispatcher + 3 registry + 6 chat-completions route tests (`app.inject` with stubbed dispatcher: 401/401/400/503/503/200). Total now **131 / 131** (was 114).

### Step 6.5 — Smoke Compose + CI

- **Compose `p2p-local` profile** in `docker-compose.yml` adds a `dht` container (running `hyperdht --node` on port 49737) and defaults `P2P_BOOTSTRAP=dht:49737` for backend + workers. Default `compose up` still uses the public Holepunch DHT.
- **CI matrix**: new `docker:build` job in `.github/workflows/ci.yml` runs `docker buildx build` against both `docker/backend.Dockerfile` and `docker/worker.Dockerfile` after the lint/typecheck/test/build job succeeds. `gha` cache scoped per image keeps the second run fast.
- **README**: new "Smoke run" subsection under "Quick Start (Docker Compose)" with the `curl` recipe (create key → dispatch chat completion).
- **Architecture doc**: new §4.1 explaining the two ways to bring up the swarm (public DHT vs `p2p-local`).

### Step 7 — Streaming SSE inference

- **Backend StreamTransport** (`apps/backend/src/p2p/stream-transport.ts`): small interface (`openStream(workerPubKey, request, signal)`) the dispatcher consumes; production impl opens a fresh `dht.connect(workerPubKey)` per stream and attaches Protomux to the encrypted Hyperswarm secret stream (per `docs/architecture.md` §2.3).
- **Worker stream-channel server** (`apps/worker/src/runtime/stream-channel.ts`): for each `swarm.on('connection')`, attaches `Protomux.from(stream)` and registers the `cosmic/inference-stream/v1` channel. Decodes the wire `InferenceRequest`, derives an `AbortSignal` from the channel's close event, drives the existing `streamInference` async generator, and emits Compact-Encoded frames back. Wired into `worker.ts` and torn down on SIGINT/SIGTERM.
- **Dispatcher**: new `dispatchStream(request, apiKeyId, signal)` async generator. Single-attempt selection (no re-dispatch on the streaming path — the architecture doc commits to surfacing mid-stream worker failure to the client). Lifecycle: pending→dispatched→running→complete│failed in `JobsState`. Audit events: `inference.dispatched / completed / failed` with `streaming: true`.
- **Route**: `POST /v1/chat/completions` now branches on `body.stream === true`. SSE headers + `reply.hijack()` + backpressure-aware writes via `once('drain')`. Each chunk → `ChatCompletionChunk` (delta + role); `final` envelope → last chunk with `finish_reason`; stream terminates with `data: [DONE]\n\n`. Errors mid-stream emit a `data: { error: ApiErrorBody }\n\n` then `[DONE]`. Client disconnect → `AbortController.abort()` → dispatcher aborts the generator → worker observes channel close → generator ends with `finishReason: 'cancelled'`.
- **Ambient declarations**: `apps/{backend,worker}/src/types/protomux.d.ts` cover the static `Protomux.from`, `createChannel`, `addMessage`, and message `send` surfaces we touch.
- **Architecture + README**: `docs/architecture.md` failure-scenarios table gets a "client-disconnect mid-stream" row; `apps/backend/README.md` flips the `stream: true` row from 🚧 Step 7 to ✅ live.
- **Tests**: 4 new dispatcher streaming tests + 2 new SSE route tests. Total now **136 / 136** (was 131; the obsolete `stream:true → 400` rejection test was removed since the route now serves SSE).
- **Out of scope**: SSE heartbeats (`: keep-alive\n\n`) every 20 s; documented as Future Improvement. Live Protomux integration is exercised in the Step 6.5 Compose smoke run; unit tests use an injected `StreamTransport` stub.

### Step 8 — Telemetry + `/metrics` + `/v1/usage/me`

- **`MetricsRegistry`** (`apps/backend/src/observability/metrics.ts`): in-memory counters (`success` / `failed` / `cancelled` requests, `prompt` / `completion` tokens, rate-limit rejections), a fixed-size ring buffer of latency samples (default 1000) with lazy `avg` / `p50` / `p95` / `p99` computation in `snapshot()`, and lazy worker gauges. Constructor takes `bufferSize`, `workersConnected`, `workersCapacity` for tests.
- **`MetricsResponse` DTO** (`packages/shared/src/dto/metrics.dto.ts`): TypeBox schema mirroring `MetricsRegistry.snapshot()` 1:1 so the response is validated and the frontend dashboard consumes the same shape verbatim.
- **Routes**:
  - `GET /metrics` (`routes/metrics.route.ts`): public, opt-out from rate limiting (so liveness scrapers cannot DoS themselves), returns the JSON snapshot.
  - `GET /v1/usage/me` (`routes/usage.route.ts`): authenticated. Aggregates the caller's `UsageState` records into totals + a sorted `windows[]` (capped at 24).
- **Plugin** (`plugins/metrics.plugin.ts`): decorates `app.metrics` with the `MetricsRegistry`. Registered before `state` / `auth` / `rate-limit` / `p2p` so the registry is available to every consumer.
- **Dispatcher instrumentation**: `dispatch` and `dispatchStream` now record `success` / `failed` / `cancelled` outcomes plus `prompt` / `completion` tokens and end-to-end latency on every completion. Streaming aborts surface as `cancelled`.
- **Error-handler instrumentation**: the central error handler increments `metrics.rateLimit.rejections` whenever it produces a 429 envelope.
- **P2P bootstrap**: `bootstrapP2p` late-binds the worker gauges so `MetricsRegistry.snapshot().workers.{connected, capacity}` reflects the live registry.
- **Tests**: 17 new across `observability/metrics.test.ts` (8), `routes/metrics.route.test.ts` (6 — `/metrics` zero / observed / no-rate-limit + `/v1/usage/me` 401 / aggregated / empty), `p2p/dispatcher.test.ts` (3 metrics observation paths). Existing `plugins/rate-limit.plugin.test.ts` 429 test asserts the metrics counter increments. Total now **153 / 153** (was 136).
- **Out of scope**: Prometheus exposition, frontend dashboard polling, persistence of counters across restarts. All three captured in `docs/architecture.md` §6.

### Step 8.5 — HyperDB awareness

The brief explicitly names HyperDB. We evaluated `hyperdb@6.x` against the `KvStore` interface and concluded it is the wrong tool for our generic key-string → JSON-value workload (schema-first document DB with codegen-driven definitions, collection-scoped `db.insert / get / find` API, mandatory `db.flush()`). Hyperbee — the engine HyperDB itself sits on for its `bee` backend — stays the production K/V layer.

- **Awareness demo** (`apps/backend/scripts/hyperdb-demo/`): one-time spec generator (`build-spec.cjs`), the generated `spec/` (committed: hyperschema + hyperdb output), and a runnable `run.mjs` that opens a temp Hypercore, wraps it in `HyperDB.bee(core, definition, { autoUpdate: true })`, exercises insert / get / find / delete / flush, and cleans up. Wired into the backend as `pnpm --filter @cosmic/backend demo:hyperdb`.
- **Dependencies**: `hyperdb` and `hyperschema` added as **devDependencies** of `@cosmic/backend` (used only by the demo, not the runtime).
- **Architecture doc**: §2.4 gains a "HyperDB vs Hyperbee — why we chose Hyperbee" subsection covering the API surface, the substrate equivalence, and the future-migration path. The trade-off in §4 cross-links the demo.
- **No changes to the runtime state layer**: `STATE_BACKEND` still accepts `memory` and `hyperbee`; the existing 153 tests are unaffected.
- **No new tests** here — the demo _is_ the test (it asserts behaviour by running end-to-end and printing real records).
