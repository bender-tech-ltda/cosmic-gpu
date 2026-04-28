# syntax=docker/dockerfile:1.7
# Frontend image — Vite-built static SPA served by nginx.
# Build-time args:
#   VITE_BACKEND_URL  — absolute URL of the backend (e.g. http://backend:3000).
#                       Empty means "rely on a reverse proxy / same-origin".

ARG NODE_IMAGE=node:22-bookworm-slim
ARG NGINX_IMAGE=nginx:1.27-alpine

# ---- deps ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/vitest.config.ts ./packages/shared/
COPY apps/frontend/package.json apps/frontend/tsconfig.json apps/frontend/vitest.config.ts ./apps/frontend/
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
ARG VITE_BACKEND_URL=
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
COPY packages/shared ./packages/shared
COPY apps/frontend ./apps/frontend
RUN pnpm --filter @cosmic/shared build
RUN pnpm --filter @cosmic/frontend build

# ---- runtime ----
FROM ${NGINX_IMAGE} AS runtime
# SPA-friendly nginx that also reverse-proxies the backend endpoints so the
# bundle can use same-origin URLs (matching the dev Vite proxy). The
# upstream is parameterised at container start via `BACKEND_UPSTREAM`
# (defaults to `backend:3000`, the Compose service name).
ENV BACKEND_UPSTREAM=backend:3000
COPY docker/frontend-nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q -O - http://127.0.0.1/ >/dev/null 2>&1 || exit 1

LABEL org.opencontainers.image.source="https://github.com/cosmic/cosmic-take-home"
