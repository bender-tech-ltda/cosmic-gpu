# syntax=docker/dockerfile:1.7
# Backend (Fastify) image — multi-stage, non-root.
# `bookworm-slim` is preferred over `alpine` because the Holepunch native
# bindings (sodium-universal, hypercore, hyperbee) compile reliably against
# glibc.

ARG NODE_IMAGE=node:22-bookworm-slim

# ---- deps ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/vitest.config.ts ./packages/shared/
COPY apps/backend/package.json apps/backend/tsconfig.json apps/backend/vitest.config.ts ./apps/backend/
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend
RUN pnpm --filter @cosmic/shared build
RUN pnpm --filter @cosmic/backend build

# ---- runtime ----
FROM ${NODE_IMAGE} AS runtime
# Holepunch's `rocksdb-native` requires libatomic at runtime on Linux
# (per its README). `node:*-bookworm-slim` does not ship it, so its
# prebuilds dlopen fails with `libatomic.so.1: cannot open shared object
# file`. The require-addon loader masks this as MODULE_NOT_FOUND because
# it overwrites `cause` while iterating fallback candidates.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libatomic1 \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
ENV NODE_ENV=production
ENV BACKEND_HOST=0.0.0.0
ENV BACKEND_PORT=3000
ENV DATA_DIR=/data
COPY --from=build /repo /app
# Named volume `backend-data:/data` is created owned by root by Docker;
# the runtime user `node` (uid 1000) needs to be able to mkdir under it
# for Hyperbee/Hypercore state. Pre-create + chown so the volume mount
# inherits ownership when first attached to a fresh volume.
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.BACKEND_PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/backend/dist/server.js"]

LABEL org.opencontainers.image.source="https://github.com/cosmic/cosmic-take-home"
