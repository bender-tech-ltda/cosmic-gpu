# `@cosmic/backend` — Fastify API + Dispatcher

The HTTP gateway and P2P dispatcher for the Cosmic GPU cloud.

## Responsibilities

- Expose **OpenAI-compatible** inference endpoints (streaming + non-streaming).
- Manage **API keys** (create / list / revoke) and authenticate every request.
- Apply per-API-key **rate limiting**.
- Dispatch inference work to workers via **Hyperswarm RPC**.
- Maintain distributed state (workers, keys, jobs, usage) in **HyperDB**.
- Serve the auto-generated **OpenAPI / Swagger UI** at `/docs`.
- Provide `/health` and `/metrics` endpoints.

## Endpoints (Planned)

| Method   | Path                   | Auth    | Notes                                      |
| -------- | ---------------------- | ------- | ------------------------------------------ |
| `GET`    | `/health`              | —       | Liveness + p2p connection status           |
| `GET`    | `/metrics`             | —       | JSON or Prometheus format                  |
| `POST`   | `/api-keys`            | API key | Create a new key (plaintext returned once) |
| `GET`    | `/api-keys`            | API key | List the caller's keys                     |
| `DELETE` | `/api-keys/:id`        | API key | Revoke a key                               |
| `GET`    | `/v1/models`           | —       | List available worker capabilities         |
| `POST`   | `/v1/chat/completions` | API key | Streaming + non-streaming inference        |

## Project Structure

```
src/
├── routes/         # Fastify route handlers
├── services/       # Business logic
├── plugins/        # Fastify plugins (auth, rate-limit, swagger, p2p, telemetry)
├── p2p/            # Hyperswarm RPC client + dispatcher
├── state/          # HyperDB / Hyperbee accessors
├── config/         # Env loading + validation
└── server.ts       # Fastify bootstrap
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
