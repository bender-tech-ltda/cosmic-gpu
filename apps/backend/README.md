# `@cosmic/backend` — Fastify API + Dispatcher

The HTTP gateway and P2P dispatcher for the Cosmic GPU cloud.

## Responsibilities

- Expose **OpenAI-compatible** inference endpoints (streaming + non-streaming).
- Manage **API keys** (create / list / revoke), hash them with HMAC-SHA-256, and validate `Authorization: Bearer <key>` on every protected request.
- Apply per-API-key **rate limiting** (`@fastify/rate-limit`, in-memory).
- Dispatch inference work to workers via **Hyperswarm RPC**.
- Maintain distributed state (workers, keys, jobs, usage) in **Hyperbee on Hypercore** behind a swappable `KvStore` interface.
- Serve the auto-generated **OpenAPI / Swagger UI** at `/docs`.
- Provide `/health` (live), `/metrics` (live), and `/v1/usage/me` (live).

## Endpoints

| Status  | Method   | Path                   | Auth    | Notes                                                                   |
| ------- | -------- | ---------------------- | ------- | ----------------------------------------------------------------------- |
| ✅ live | `GET`    | `/health`              | —       | Liveness + live P2P peer count                                          |
| ✅ live | `GET`    | `/metrics`             | —       | In-memory JSON snapshot (counters / token totals / latency percentiles) |
| ✅ live | `POST`   | `/v1/api-keys`         | public¹ | Create a new key (plaintext returned exactly once)                      |
| ✅ live | `GET`    | `/v1/api-keys`         | public¹ | List API keys (public-safe; no plaintext / hash leaked)                 |
| ✅ live | `DELETE` | `/v1/api-keys/:id`     | public¹ | Revoke a key (idempotent)                                               |
| ✅ live | `GET`    | `/v1/models`           | —       | List available worker capabilities (mock-llm placeholder)               |
| ✅ live | `POST`   | `/v1/chat/completions` | API key | Non-streaming inference                                                 |
| ✅ live | `POST`   | `/v1/chat/completions` | API key | Streaming inference (SSE, `stream: true`)                               |
| ✅ live | `GET`    | `/v1/usage/me`         | API key | Per-key usage summary (totals + most recent windows)                    |

¹ The `/v1/api-keys` management endpoints are deliberately **unauthenticated** for the take-home demo — otherwise the very first key creation has a chicken-and-egg problem. Production hardening (admin-token / mTLS) is captured in [`docs/architecture.md`](../../docs/architecture.md) §4 + §6. Inference endpoints (Steps 6–7) will require a Bearer key via the `app.authenticate` `preHandler`.

## Project Structure

```
src/
├── auth/            # Bearer parsing + HMAC-SHA-256 hashing helpers
├── config/          # envalid loader → typed BackendConfig
├── errors/          # DomainError + isDomainError
├── observability/   # logEvent helper + AUDIT_EVENT map + MetricsRegistry
├── p2p/             # Hyperswarm join + RPC client + dispatcher + stream transport
├── plugins/         # Fastify plugins: helmet, cors, swagger, request-id,
│                   # error-handler, metrics, state, auth, rate-limit, p2p
├── routes/          # Fastify route handlers (one file per resource)
├── services/        # Business logic (api-keys.service.ts)
├── state/           # KvStore interface + in-memory + Hyperbee adapters
│                   # + identity (seed-derived ed25519 keypair) + accessors
├── types/           # Ambient declarations for hyperbee/hypercore
├── app.ts           # buildApp(opts) factory — used by tests + server.ts
└── server.ts        # Fastify bootstrap with graceful SIGINT/SIGTERM
```

## Scripts

```bash
pnpm --filter @cosmic/backend dev       # tsx watch
pnpm --filter @cosmic/backend build     # tsc → dist/
pnpm --filter @cosmic/backend start     # node dist/server.js
pnpm --filter @cosmic/backend test      # vitest
pnpm --filter @cosmic/backend lint
pnpm --filter @cosmic/backend typecheck
```

## Environment Variables

See [`../../.env.example`](../../.env.example).

## Related Rules

- [`coding-standards.mdc`](../../.cursor/rules/coding-standards.mdc)
- [`api-documentation.mdc`](../../.cursor/rules/api-documentation.mdc)
- [`p2p-architecture.mdc`](../../.cursor/rules/p2p-architecture.mdc)
- [`security-standards.mdc`](../../.cursor/rules/security-standards.mdc)
- [`observability.mdc`](../../.cursor/rules/observability.mdc)
