# `@cosmic/worker` — Simulated GPU Worker Node

A Hyperswarm peer that registers as a "GPU worker" and serves inference requests with a synthetic token generator (mock LLM).

## Responsibilities

- Persist a stable **ed25519 identity** as a 32-byte seed at `NODE_KEYPAIR_PATH`; derive `{ publicKey, secretKey }` per boot via `HyperDHT.keyPair(seed)`.
- Join the shared **Hyperswarm topic** (`P2P_DISCOVERY_TOPIC`) with that keypair, optionally bootstrapped via `P2P_BOOTSTRAP`.
- Expose **RPC methods** to the backend dispatcher (Compact Encoding payloads from `@cosmic/shared`):
  - `inference.run(req)` — non-streaming completion (`@hyperswarm/rpc`).
  - `worker.health()` — capacity, in-flight count, uptime, model id (`@hyperswarm/rpc`).
  - `inference.stream(req)` — token-by-token streaming. The handler is implemented and unit-tested today; the **Protomux substream binding** that carries it lands with the streaming SSE bridge in Step 7. See [`docs/architecture.md`](../../docs/architecture.md) §2.3.
- Drive the synthetic token generator (mock LLM) deterministically per `jobId`.
- Increment / decrement an **in-flight counter** so `worker.health` advertises live load. The backend polls `worker.health`; **no worker-initiated heartbeat timer** — keeps moving state minimal.

## Project Structure

```
src/
├── config/         # envalid loader → typed WorkerConfig
├── handlers/       # runInference, streamInference, buildHealthSnapshot
├── observability/  # Pino logger + WORKER_AUDIT_EVENT helper
├── runtime/        # identity (seed-derived keypair), swarm.ts, rpc-server.ts
├── simulator/      # Mock LLM (deterministic, AbortSignal-aware)
├── types/          # Ambient declarations for hyperdht/hyperswarm/@hyperswarm/rpc
└── worker.ts       # Entrypoint (config → identity → swarm → RPC → shutdown)
```

## Mock LLM Behavior

The worker does **not** run a real model. The simulator (`src/simulator/mock-llm.ts`) produces:

- A pseudo-streamed sequence of tokens drawn from a small vocabulary, seeded by SHA-256 of the `jobId` so retries are deterministic.
- A final envelope with `promptTokens`, `completionTokens`, and a `finishReason` (`stop` / `length` / `cancelled`).
- Throughput limited by `MOCK_LLM_TOKEN_RATE_HZ`; cancellation propagated through an `AbortSignal`.

## Future Improvements

Not in scope for the take-home but worth recording:

- **Signed result envelopes** — worker signs `InferenceResponseFinal` with its `secretKey`; backend verifies against the registry's `pubKey`. Adds non-repudiation on top of Noise's confidentiality. Tracked in [`docs/architecture.md`](../../docs/architecture.md) §6.
- **Heartbeat jitter** — ±20% randomization on the backend's `worker.health` poll cadence so all workers don't ping at once.
- **Capacity-aware shedding** — reject new `inference.run` calls when `inFlight >= capacity` instead of queueing.

## Scripts

```bash
pnpm --filter @cosmic/worker dev          # tsx watch
pnpm --filter @cosmic/worker build        # tsc → dist/
pnpm --filter @cosmic/worker start        # node dist/worker.js
pnpm --filter @cosmic/worker test
pnpm --filter @cosmic/worker lint
pnpm --filter @cosmic/worker typecheck
```

## Environment Variables

See [`../../.env.example`](../../.env.example) for the full list. Worker-specific knobs:

| Variable                       | Default                 | Notes                                                               |
| ------------------------------ | ----------------------- | ------------------------------------------------------------------- |
| `WORKER_ID`                    | `worker-local`          | Used in audit logs and the `WorkerHealth` envelope                  |
| `WORKER_LOG_LEVEL`             | `info`                  | Standard Pino levels                                                |
| `WORKER_HEARTBEAT_INTERVAL_MS` | `10000`                 | Soft-removal threshold; backend polls at this cadence               |
| `WORKER_CAPACITY`              | `4`                     | Maximum concurrent jobs advertised by `worker.health`               |
| `WORKER_MODEL_ID`              | `mock-llm`              | Model id served (informational only for the demo)                   |
| `MOCK_LLM_TOKEN_RATE_HZ`       | `25`                    | Synthetic token rate per second                                     |
| `MOCK_LLM_MAX_TOKENS`          | `64`                    | Hard cap on synthetic tokens per job                                |
| `P2P_DISCOVERY_TOPIC`          | (empty → dev fallback)  | Shared 32-byte topic; **must** match the backend                    |
| `P2P_BOOTSTRAP`                | (empty → public DHT)    | Optional `host:port[,host:port...]` HyperDHT bootstrap nodes        |
| `NODE_KEYPAIR_PATH`            | `./data/worker.keypair` | Path to the persisted 32-byte seed (the keypair is derived from it) |
| `DATA_DIR`                     | `./data`                | Local data directory                                                |

## Related Rules

- [`p2p-architecture.mdc`](../../.cursor/rules/p2p-architecture.mdc)
- [`coding-standards.mdc`](../../.cursor/rules/coding-standards.mdc)
- [`security-standards.mdc`](../../.cursor/rules/security-standards.mdc)
- [`observability.mdc`](../../.cursor/rules/observability.mdc)
