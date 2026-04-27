# Cosmic — Distributed GPU Cloud Service

A simplified, decentralized AI PaaS built on the Holepunch P2P stack. Demonstrates API key management, OpenAI-compatible inference, and workload distribution across simulated GPU "worker nodes".

> Take-home assignment for the **Senior Fullstack Software Engineer** role at Tether Operations Limited. Scope: 2 days. See [`CLAUDE.md`](./CLAUDE.md) for the full project brief and operating procedure.

## High-Level Architecture

```
Browser (React)
   │ HTTP + SSE
   ▼
Backend (Fastify)  ──── Hyperbee on Hypercore (state, behind a swappable KvStore)
   │ Hyperswarm RPC  +  Protomux substream (streaming)
   ▼
Worker × N  ──── Hyperswarm (P2P discovery via HyperDHT + Noise)
```

- **Backend** acts as a dispatcher. It exposes OpenAI-compatible endpoints and routes inference work to available workers via Hyperswarm RPC.
- **Workers** are independent Node processes that join the same Hyperswarm topic and stream synthetic tokens (mock LLM) for inference requests.
- **State** lives in **Hyperbee on Hypercore** behind a `KvStore` interface (`apps/backend/src/state/`). The interface keeps a future swap to HyperDB feasible. Stored namespaces: worker registry, API keys (hashed), job state, usage records.
- **Frontend** is a React + Vite dashboard for API key management, an inference playground, and live usage metrics.
- **Streaming transport.** `@hyperswarm/rpc` carries `inference.run` and `worker.health` (request/response). `inference.stream` uses a Protomux channel over the encrypted Hyperswarm session for token-by-token streaming. The decision and trade-offs are documented in [`docs/architecture.md`](./docs/architecture.md) §2.3.

For the architectural decisions, trade-offs, and scalability considerations, see [`docs/architecture.md`](./docs/architecture.md). Live progress is tracked in [`docs/requirements-tracking.md`](./docs/requirements-tracking.md).

## Repository Layout

```
.
├── apps/
│   ├── backend/    # Fastify API + dispatcher
│   ├── frontend/   # React + Vite dashboard
│   └── worker/     # Hyperswarm peer (mock LLM)
├── packages/
│   └── shared/     # Compact-encoding schemas, DTOs, topic constants
├── docker/         # Dockerfiles for each app
├── docs/           # Architecture document + diagrams
├── .cursor/rules/  # AI assistant rules
├── .github/workflows/  # CI/CD
├── docker-compose.yml  # 1 backend + ≥3 workers
└── CLAUDE.md       # AI assistant north-star
```

## Prerequisites

- Node.js 22+ (`.nvmrc` provided — run `nvm use`).
- pnpm 9+ (`corepack enable && corepack prepare pnpm@9.12.0 --activate`).
- Docker + Docker Compose (for the distributed simulation).

## Quick Start (Native)

```bash
# 1. Install
nvm use
pnpm install

# 2. Configure
cp .env.example .env
# (Optionally generate a real P2P topic and HMAC secret per comments in .env.example)

# 3. Run (in separate terminals)
pnpm --filter @cosmic/backend dev
pnpm --filter @cosmic/worker dev
pnpm --filter @cosmic/frontend dev

# 4. Visit
open http://localhost:5173        # frontend
open http://localhost:3000/docs   # OpenAPI / Swagger UI
```

## Quick Start (Docker Compose — Distributed Simulation)

```bash
cp .env.example .env
pnpm compose:up         # docker compose up --build
# 1 backend + 3 workers join the same Hyperswarm topic
# When you're done:
pnpm compose:down       # docker compose down -v
```

If the public Holepunch DHT is unreachable from your network, set `P2P_BOOTSTRAP=host:port[,...]` in `.env` to point at a local DHT bootstrap.

## Available Scripts

```bash
pnpm dev            # run all apps in parallel (dev mode)
pnpm build          # build all apps
pnpm test           # run all tests in WATCH mode (vitest)
pnpm test:run       # run all tests once (vitest run) — use this in CI / pre-commit
pnpm lint           # lint all apps
pnpm typecheck      # typecheck all apps
pnpm format         # write Prettier formatting
pnpm format:check   # verify Prettier formatting
pnpm compose:up     # docker compose up --build
pnpm compose:down   # docker compose down -v
pnpm clean          # remove dist + node_modules
```

## Status

CI runs lint → typecheck → test → build → format check on every push to `main` and every PR (`.github/workflows/ci.yml`). Add the GitHub Actions badge to this section once the workflow has run once.

## Why no Turborepo / Nx?

We deliberately use plain **pnpm workspaces** without a higher-level orchestrator. The dependency graph is shallow (`@cosmic/shared` → backend / worker / frontend) and only four packages exist, so `pnpm -r --parallel --filter` already gives us parallel execution and per-package targeting. Adding Turbo/Nx would buy build caching at the cost of one more concept to explain in the demo video. Trivial to introduce later — see `docs/architecture.md` for the trade-off discussion.

## Environment Variables

See [`.env.example`](./.env.example) for the full list.

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — AI assistant brief (read this first).
- [`docs/architecture.md`](./docs/architecture.md) — design, trade-offs, scaling, future work.
- [`http://localhost:3000/docs`](http://localhost:3000/docs) — generated OpenAPI spec (when backend is running).
- [`.cursor/rules/`](./.cursor/rules) — coding/architecture/testing rules used by the AI assistant.

## License

This is a take-home assignment — not licensed for production use.
