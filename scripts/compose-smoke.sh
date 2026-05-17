#!/usr/bin/env bash
# Compose smoke test: bring up the stack, wait for the swarm to form, exercise
# both non-streaming and streaming inference, then tear down.
#
# Exits non-zero on any failure so this can run in CI (gate behind a label /
# manual trigger — full build + 60s wait makes it too slow for every PR).

set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
EXPECTED_PEERS="${EXPECTED_PEERS:-3}"
EXPECTED_CAPACITY="${EXPECTED_CAPACITY:-12}"
SWARM_TIMEOUT="${SWARM_TIMEOUT:-90}"
STREAM_TIMEOUT="${STREAM_TIMEOUT:-30}"
LEAVE_UP="${LEAVE_UP:-0}"

log() { printf '[smoke] %s\n' "$*"; }
fail() { printf '[smoke] FAIL: %s\n' "$*" >&2; exit 1; }

cleanup() {
  if [ "$LEAVE_UP" = "1" ]; then
    log "LEAVE_UP=1 — leaving Compose stack running"
    return
  fi
  log "tearing down Compose stack"
  docker compose down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "building + starting Compose stack"
docker compose up --build -d >/dev/null

log "waiting up to ${SWARM_TIMEOUT}s for peers >= ${EXPECTED_PEERS} and capacity >= ${EXPECTED_CAPACITY}"
deadline=$(( $(date +%s) + SWARM_TIMEOUT ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  health=$(curl -sf "$BACKEND_URL/health" 2>/dev/null || true)
  metrics=$(curl -sf "$BACKEND_URL/metrics" 2>/dev/null || true)
  peers=$(printf '%s' "$health" | python3 -c 'import sys,json;d=json.loads(sys.stdin.read() or "{}");print(d.get("p2p",{}).get("peers",-1))' 2>/dev/null || echo -1)
  capacity=$(printf '%s' "$metrics" | python3 -c 'import sys,json;d=json.loads(sys.stdin.read() or "{}");print(d.get("workers",{}).get("capacity",-1))' 2>/dev/null || echo -1)
  if [ "$peers" -ge "$EXPECTED_PEERS" ] 2>/dev/null && [ "$capacity" -ge "$EXPECTED_CAPACITY" ] 2>/dev/null; then
    log "swarm formed: peers=$peers capacity=$capacity"
    break
  fi
  sleep 3
done

if [ "${peers:--1}" -lt "$EXPECTED_PEERS" ] 2>/dev/null || [ "${capacity:--1}" -lt "$EXPECTED_CAPACITY" ] 2>/dev/null; then
  log "last /health:"; printf '%s\n' "$health" | head -5
  log "last /metrics:"; printf '%s\n' "$metrics" | head -10
  fail "swarm did not form within ${SWARM_TIMEOUT}s (peers=${peers:-?} capacity=${capacity:-?})"
fi

log "creating an API key"
key_response=$(curl -sf -X POST "$BACKEND_URL/v1/api-keys" -H 'Content-Type: application/json' -d '{"name":"smoke"}')
API_KEY=$(printf '%s' "$key_response" | python3 -c 'import sys,json;print(json.load(sys.stdin)["plaintext"])')
if [ -z "$API_KEY" ]; then fail "could not extract plaintext from key response: $key_response"; fi
log "key prefix: ${API_KEY:0:14}..."

log "non-streaming inference"
ns_response=$(curl -sf -X POST "$BACKEND_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"mock-llm","messages":[{"role":"user","content":"hi"}]}')
finish_reason=$(printf '%s' "$ns_response" | python3 -c 'import sys,json;print(json.load(sys.stdin)["choices"][0]["finish_reason"])')
total_tokens=$(printf '%s' "$ns_response" | python3 -c 'import sys,json;print(json.load(sys.stdin)["usage"]["total_tokens"])')
log "non-streaming OK: finish=${finish_reason} total_tokens=${total_tokens}"
[ "$total_tokens" -gt 0 ] || fail "non-streaming returned 0 tokens"

log "streaming inference (SSE)"
stream_tmp=$(mktemp)
if ! curl -sf -N --max-time "$STREAM_TIMEOUT" -X POST "$BACKEND_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"model":"mock-llm","stream":true,"messages":[{"role":"user","content":"stream test"}]}' > "$stream_tmp"; then
  log "streaming response (partial):"; head -20 "$stream_tmp" >&2
  rm -f "$stream_tmp"
  fail "streaming request failed within ${STREAM_TIMEOUT}s"
fi

chunks=$(grep -c '^data: {' "$stream_tmp" || true)
done_marker=$(grep -c '^data: \[DONE\]$' "$stream_tmp" || true)
rm -f "$stream_tmp"
log "streaming OK: chunks=$chunks done_marker=$done_marker"
[ "$chunks" -gt 0 ] || fail "no streaming chunks received"
[ "$done_marker" -ge 1 ] || fail "no [DONE] marker in stream"

log "ALL PASS"
