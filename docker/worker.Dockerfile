# syntax=docker/dockerfile:1.7
# Worker image — multi-stage, non-root. Until Step 5 the worker entrypoint is
# a placeholder; once the Hyperswarm + RPC server lands the same image picks
# up the real runtime via `apps/worker/dist/index.js`.

ARG NODE_IMAGE=node:22-bookworm-slim

# ---- deps ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/vitest.config.ts ./packages/shared/
COPY apps/worker/package.json apps/worker/tsconfig.json apps/worker/vitest.config.ts ./apps/worker/
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker
RUN pnpm --filter @cosmic/shared build
RUN pnpm --filter @cosmic/worker build

# ---- runtime ----
FROM ${NODE_IMAGE} AS runtime
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data
COPY --from=build /repo /app
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]
USER node
CMD ["node", "apps/worker/dist/src/worker.js"]

LABEL org.opencontainers.image.source="https://github.com/cosmic/cosmic-take-home"
