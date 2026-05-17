#!/bin/sh

set -u

PROJECT="${P2P_DIAG_PROJECT:-cosmic-p2p-rpc-diagnostic}"
COMPOSE_FILE="${P2P_DIAG_COMPOSE_FILE:-diagnostics/p2p-rpc/compose.yml}"
KEEP="${P2P_DIAG_KEEP:-0}"

cleanup() {
  docker compose -p "$PROJECT" -f "$COMPOSE_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
}

if [ "$KEEP" != "1" ]; then
  trap cleanup INT TERM EXIT
  cleanup
fi

docker compose -p "$PROJECT" -f "$COMPOSE_FILE" up --build --abort-on-container-exit --exit-code-from client client
status=$?

docker compose -p "$PROJECT" -f "$COMPOSE_FILE" logs --no-color dht server client

if [ "$KEEP" != "1" ]; then
  cleanup
fi

exit "$status"
