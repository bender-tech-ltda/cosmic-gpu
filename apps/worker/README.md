# `@cosmic/worker` — Simulated GPU Worker Node

A Hyperswarm peer that registers as a "GPU worker" and serves inference requests with a synthetic token generator (mock LLM).

## Responsibilities

- Join the shared **Hyperswarm topic** (`P2P_DISCOVERY_TOPIC`).
- Expose **RPC methods** to the backend dispatcher:
  - `inference.run(req)` — non-streaming completion.
  - `inference.stream(req)` — streaming token chunks.
  - `worker.health()` — capacity and queue depth.
- Emit periodic **heartbeats** to the worker registry (HyperDB).
- Sign result envelopes with the worker's identity keypair.

## Project Structure

```
src/
├── handlers/       # RPC method implementations
├── runtime/        # Hyperswarm peer + RPC server + identity keypair
├── simulator/      # Synthetic token generator (mock LLM)
├── config/
└── worker.ts       # Entrypoint
```

## Mock LLM Behavior

The worker does **not** run a real model. The simulator produces:
- A pseudo-streamed sequence of tokens with configurable delay.
- A final completion summary with token counts and latency.
- Optional injected failure modes (slow / disconnected / truncated) for resilience testing.

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

See [`../../.env.example`](../../.env.example).

## Related Rules

- [`p2p-architecture.mdc`](../../.cursor/rules/p2p-architecture.mdc)
- [`coding-standards.mdc`](../../.cursor/rules/coding-standards.mdc)
- [`security-standards.mdc`](../../.cursor/rules/security-standards.mdc)
- [`observability.mdc`](../../.cursor/rules/observability.mdc)
