# Cosmic GPU Cloud — Architecture

> Living document. It will be appended to as each subsequent step lands. The intent is for the reviewer to find every architectural decision, trade-off, and known gap in **one** place rather than discovering them through code comments.

## 1. System Design

The platform is split into three runtime processes plus shared contracts:

```text
┌────────────┐     HTTP/JSON + SSE      ┌────────────────────────────┐    Hyperswarm RPC + Protomux     ┌────────────┐
│  Frontend  │ ───────────────────────► │ Backend (Fastify dispatcher)│ ────────────────────────────────►│  Worker(s) │
│  (React)   │ ◄───────────────────────│  + Hyperbee state store     │ ◄────────────────────────────────│ (mock LLM) │
└────────────┘                          └────────────────────────────┘                                  └────────────┘
                                              ▲
                                              │ Compact Encoding wire format (`packages/shared`)
                                              ▼
                                       ┌──────────────┐
                                       │ HyperDHT     │
                                       │ (discovery)  │
                                       └──────────────┘
```

- **Backend** (`apps/backend`) — Fastify HTTP API. Owns auth, rate-limiting, request validation, dispatch decisions, and SSE bridging. Persists state in Hyperbee on Hypercore behind a `KvStore` interface (see `apps/backend/src/state/`).
- **Worker** (`apps/worker`) — Joins the Hyperswarm topic, exposes RPC methods (`inference.run`, `inference.stream`, `worker.health`), generates synthetic tokens. Will be wired in Step 5.
- **Frontend** (`apps/frontend`) — React/Vite dashboard for keys, playground, and usage. Will be wired in Steps 9–10.
- **Shared** (`packages/shared`) — TypeBox HTTP DTOs, Compact Encoding RPC schemas, constants, error codes. The single source of truth for cross-process contracts.

## 2. Distributed Approach

### 2.1 Discovery (Hyperswarm)

All nodes (backend + workers) join a shared 32-byte topic, configured via `P2P_DISCOVERY_TOPIC`. Every node announces with `client: true, server: true`, forming a complete-graph mesh for ≤10 peers. NAT traversal is automatic via HyperDHT.

For local Compose runs we expose an optional `P2P_BOOTSTRAP` env var (comma-separated `host:port` list). When empty, nodes fall back to the public Holepunch DHT bootstrap nodes. When set, nodes bootstrap against a deterministic local seed — useful for offline demos or networks that block the public DHT.

### 2.2 Identity

Every node persists a 32-byte ed25519 **seed** at `NODE_KEYPAIR_PATH`. On boot, the seed is loaded and a real `{ publicKey: Buffer(32), secretKey: Buffer(64) }` keypair is derived via `HyperDHT.keyPair(seed)` (libsodium `crypto_sign_seed_keypair`). The keypair is the same across restarts, so the worker registry's `workers/<pubkey>` rows remain stable, and Step 5 can pass the keypair directly to Hyperswarm. Public keys logged or shown in the UI are truncated to 8 hex chars + `…`.

### 2.3 Transport Split (RPC vs streaming)

`@hyperswarm/rpc` is a request/response RPC layer; it does not natively support streamed responses. We deliberately split the transport:

- **`@hyperswarm/rpc`** — `inference.run` (non-streaming completions) and `worker.health` (heartbeat).
- **Protomux channel** over the encrypted Hyperswarm secret stream — `inference.stream` (token-by-token streaming). Each chunk is a Compact-Encoded `InferenceResponseChunk`; the channel terminates with an `InferenceResponseFinal`. Cancellation is propagated by closing the channel; the worker observes the close and aborts its generator.

Both transports run on top of the same Noise-encrypted Hyperswarm session. The split is documented in `.cursor/rules/p2p-architecture.mdc` so the rule and this document agree.

### 2.4 State (Hyperbee on Hypercore)

The `KvStore` interface (`apps/backend/src/state/types.ts`) abstracts over two adapters:

- **In-memory** — used in tests and ephemeral dev (`STATE_BACKEND=memory`). Map-backed, deep-cloned values.
- **Hyperbee** — used in production (`STATE_BACKEND=hyperbee`). Single Hyperbee tree on a single Hypercore on disk, JSON-encoded values.

Typed accessors on top of `KvStore` (`api-keys`, `workers`, `jobs`, `usage`) keep the rest of the code backend-agnostic. Hypercore's signed Merkle trees provide integrity verification for free; sparse replication is the Hyperbee default and would activate automatically if we wired multi-peer state replication (see §6).

### 2.5 Wire format (Compact Encoding)

All RPC payloads are Compact Encoded with codecs in `packages/shared/src/schemas/`. The schema policy is **append-only**: never reorder or remove fields. New fields are added at the end and made optional so older writers still produce valid wire frames. Floats (e.g. `temperature`, `topP`) are encoded as fixed-point integers (×1000) so the wire stays integer-only; this rounds to 3-decimal precision (see Trade-offs §4).

### 2.6 Workload distribution

The backend acts as a dispatcher (Step 6). Worker selection is least-in-flight with random tie-break, sourced from the local `WorkersState` accessor. Job state transitions are persisted in `JobsState` (`pending → dispatched → running → complete | failed`). A worker that misses a heartbeat for the configured TTL is soft-removed and any in-flight job is re-dispatched to another worker (non-streaming path) or surfaced to the client as an error event (streaming path).

## 3. Failure Scenarios and Resilience

| Scenario                         | Response                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| All workers offline              | Backend returns `503 NoWorkersAvailable` with `Retry-After`; the request is not queued in the MVP.               |
| Worker disappears mid-stream     | Backend terminates the SSE connection with a final `data: {error: WorkerTimeout}` event. No silent reconnection. |
| Worker disappears mid non-stream | Backend re-dispatches once to another worker; on second failure, returns `503 WorkerTimeout`.                    |
| Topic mismatch / no peers found  | Backend logs `warn` after N seconds with no peers and reports `p2p.connected: false` on `/health`.               |
| Hyperbee write conflict          | Last-write-wins with monotonic ISO timestamps on every record. Documented as a single-writer simplification.     |
| Rate limit exceeded              | `429` envelope with `Retry-After`; per-key bucket.                                                               |
| Invalid bearer                   | `401 ApiKeyInvalid` envelope; revoked keys yield `403 ApiKeyRevoked`.                                            |

## 4. Trade-offs and Deliberate Divergences

These are intentional choices that differ from the original implementation plan or the most common production pattern. Each one is recorded so the reviewer doesn't have to spelunk through code comments.

- **Plain Node.js, not Pear Runtime / Bare.** The original implementation plan recommends Pear; we chose plain Node.js because Pear modules are explicitly described as potentially "unstable" and a 2-day window punishes ecosystem risk. Pear migration is captured as future work in `.cursor/rules/pear-runtime.mdc`.
- **Hyperbee on Hypercore, not HyperDB.** Hyperbee is the simpler, more stable equivalent for our key-value workload. The `KvStore` interface keeps a future swap to HyperDB feasible.
- **Single-writer Hyperbee, not multi-peer replication.** The MVP holds state in one Hyperbee instance on the backend. Multi-writer state via `corestore` and per-worker Hypercore feeds is captured under §6 Future Improvements.
- **Public API key management endpoints** (`POST/GET/DELETE /v1/api-keys` are not Bearer-protected). Without this, the first key creation is impossible without an out-of-band admin token. Production hardening (admin token, mTLS, or signed-installer flow) is captured under §6.
- **In-memory rate limiter.** `@fastify/rate-limit` v10 with the default in-memory store means rate counters reset on restart and are not shared across multiple backend replicas. For a single-instance demo this is fine. For production, swap the store to Redis or a Hyperbee-backed sliding window (counter would live at `usage/<keyId>/<windowStart>` which we already model).
- **Mock LLM, not a real model.** Workers stream synthetic tokens. Real model serving is explicitly out of scope per the task brief.
- **Synchronous in-process error mapping.** A single Fastify error handler maps `DomainError` / validation / 429 / unknown to the shared `ApiErrorBody` envelope. We deliberately avoid spreading error formatting across handlers.
- **Fixed-point float encoding (×1000).** Inference parameters such as `temperature` and `topP` are encoded over RPC as `cuint` after multiplying by 1000. This rounds to 3-decimal precision, which is well within the OpenAI contract's tolerance and keeps the wire integer-only.
- **Mark & Sweep GC, Fork-ID truncate handling, and signed RPC results are deferred.** All three are captured in `.cursor/rules/p2p-architecture.mdc` and §6 below. We never call `core.truncate`, so Fork-ID drift cannot occur in the MVP by construction.
- **Study guide note: "encrypted with private key, decrypted with public key".** That phrasing in the study guide describes a digital signature, not encryption. Hyperswarm sessions use **Noise** (an asymmetric handshake that derives symmetric session keys); confidentiality is symmetric, authenticity is asymmetric. Calling this out so reviewers don't think we adopted a wrong mental model.

## 4.1 Local Compose details

`docker-compose.yml` ships with two ways to bring up the swarm:

- **Default (public DHT).** `docker compose up --build` boots 1 backend + 3 workers and lets them discover each other through the public Holepunch DHT bootstrap nodes. This is the closest to a real deployment.
- **`p2p-local` profile (self-contained).** `docker compose --profile p2p-local up --build` adds a `dht` service that runs `hyperdht --node` on port 49737 and sets `P2P_BOOTSTRAP=dht:49737` for the backend and workers. Useful for offline demos, CI, or networks that block the public DHT.

Named volumes (`backend-data`, `worker[1-3]-data`) persist Hyperbee/Hypercore state and node-identity seeds across container restarts so worker pubkeys stay stable.

## 5. Scaling

The current design is single-region and single-backend-replica. To scale:

- **More workers.** Just start more containers; they join the Hyperswarm topic and announce themselves. The backend's `WorkersState` registry refreshes from heartbeats. Effort: zero code, just `docker compose --scale worker=N`.
- **Multiple backend replicas.** Requires a shared rate-limit store (move from in-memory to Redis or Hyperbee) and shared state (multi-writer via `corestore` or HyperDB). Effort: medium.
- **Geographic distribution.** Hyperswarm + HyperDHT already supports cross-NAT, multi-region peering. The bottleneck shifts to the Hyperbee state store; a per-region replica with conflict resolution would be the natural next step.
- **High-throughput inference.** Bypass JSON encoding at the worker and stream raw tensors directly via Hypercore feeds (sparse replication makes this efficient). Use one Hypercore feed per job.

## 6. Future Improvements

These are deliberate "should-haves" or "could-haves" that are documented but not implemented in the 2-day window:

- **Authenticated `/v1/api-keys` management.** Gate behind an admin bearer token (rotated via a signed installer) or mTLS.
- **Distributed rate-limit store.** Replace `@fastify/rate-limit`'s default memory store with a Hyperbee-backed sliding window keyed at `usage/<keyId>/<windowStart>`.
- **Signed RPC results.** Worker signs the canonical `InferenceResponseFinal` bytes with its `secretKey`; backend verifies against the registry's `pubKey`. Adds non-repudiation on top of Noise's confidentiality.
- **Multi-writer state.** Wrap state in `corestore`; let workers write their own audit feeds; backend reads via sparse replication.
- **Mark & Sweep GC.** `core.startMarking()` → mark active blocks → `core.sweep()` to reclaim disk after revoked keys / stale jobs.
- **Fork-ID truncate handling.** When (if) we ever call `core.truncate`, propagate the new fork id to all consumers.
- **Audit feed.** Replace structured Pino `event` lines with a dedicated Hypercore feed so audit history is replicable.
- **Hyperswarm firewall callback.** Allow-list mode for production deployments where worker pubkeys are known ahead of time.
- **Heartbeat jitter.** Random ±20% jitter on `worker.health` ticks so all workers don't ping at the same instant.
- **Pear Runtime migration.** Re-evaluate after the ecosystem stabilises; see `.cursor/rules/pear-runtime.mdc`.

## 7. Review Checklist

For the reviewer / take-home grader:

- Auth happy path, missing/invalid/revoked branches: see `apps/backend/src/plugins/auth.plugin.test.ts`.
- Rate limit + 429 envelope: see `apps/backend/src/plugins/rate-limit.plugin.test.ts`.
- API key lifecycle (create → list → revoke): see `apps/backend/src/routes/api-keys.route.test.ts`.
- Wire format stability + edge cases: see `packages/shared/src/schemas/*.test.ts`.
- Identity persistence + recovery: see `apps/backend/src/state/identity.test.ts`.
- Quick start: see the README.
- Tracker / progress: see `docs/requirements-tracking.md`.
