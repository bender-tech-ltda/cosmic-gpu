# Cosmic — Distributed GPU Cloud Service

A simplified, decentralized AI PaaS built on the Holepunch P2P stack. Demonstrates API key management, OpenAI-compatible inference, and workload distribution across simulated GPU "worker nodes".

> Take-home assignment for the **Senior Fullstack Software Engineer** role at Tether Operations Limited. Scope: 2 days. See [`CLAUDE.md`](./CLAUDE.md) for the full project brief and operating procedure.

## High-Level Architecture

```
Browser (React)
   │ HTTP + SSE
   ▼
Backend (Fastify)  ──── HyperDB (distributed K/V state)
   │ Hyperswarm RPC
   ▼
Worker × N  ──── Hyperswarm (P2P discovery + transport)
```

- **Backend** acts as a dispatcher. It exposes OpenAI-compatible endpoints and routes inference work to available workers via Hyperswarm RPC.
- **Workers** are independent Node processes that join the same Hyperswarm topic and stream synthetic tokens (mock LLM) for inference requests.
- **HyperDB** stores worker registry, API keys (hashed), job state, and usage records — replacing a centralized database.
- **Frontend** is a React + Vite dashboard for API key management, an inference playground, and live usage metrics.

For the architectural decisions, trade-offs, and scalability considerations, see [`docs/architecture.md`](./docs/architecture.md).

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
docker compose up --build
# 1 backend + 3 workers join the same Hyperswarm topic
```

## Available Scripts

```bash
pnpm dev         # run all apps in parallel (dev mode)
pnpm build       # build all apps
pnpm test        # run all tests
pnpm lint        # lint all apps
pnpm typecheck   # typecheck all apps
pnpm clean       # remove dist + node_modules
```

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
