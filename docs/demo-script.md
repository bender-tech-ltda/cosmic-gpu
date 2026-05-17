# Cosmic GPU Cloud — 5-minute Demo Script

A walk-through covering everything a reviewer needs to see in roughly 5 minutes:
the architecture, the two headline features (API key management + OpenAI-compatible streaming inference), and the trade-offs documented in `docs/architecture.md`.

The script is organised by minute so you can record straight through; each section's beat list assumes the previous one is done. Line lengths are voice-friendly (≈ 14 words per beat).

## Setup before recording

```bash
# Repo root
nvm use
pnpm install
cp .env.example .env                       # all values can stay empty — see Troubleshooting in README
docker compose down -v --remove-orphans    # clean state
pnpm compose:up                            # docker compose up --build (in-Compose DHT bootstrap is default)
```

Wait until the backend log shows three `p2p.peer_added` lines:

```text
backend-1 | "p2p.peer_added" peers: 1, pubKey: 9fbcfca0…
backend-1 | "p2p.peer_added" peers: 2, pubKey: 6e100fb9…
backend-1 | "p2p.peer_added" peers: 3, pubKey: 7fb2a1e0…
```

Once all three peers have joined, `curl :3000/ready | jq` returns `status: ready, peers: 3` and `curl :3000/metrics | jq .workers` shows `connected: 3, capacity: 12`. If you want a hands-off verification, run `pnpm compose:smoke` instead — it asserts the same conditions plus streaming `[DONE]` end-to-end.

Open four browser tabs:

1. <http://localhost:5173/keys> — API key management
2. <http://localhost:5173/playground> — Streaming inference
3. <http://localhost:5173/dashboard> — Telemetry
4. <http://localhost:3000/docs> — Swagger UI

Have the repo open in your editor on `docs/architecture.md` and the project root in a terminal so you can `Cmd-Tab` quickly.

## 0:00 – 0:30 — Opening (≤ 30 s)

> "This is Cosmic, a small distributed GPU cloud demo built on the Holepunch P2P stack — Hyperswarm for discovery, HyperDHT under it, Hyperbee on Hypercore for state, and a Protomux substream for token streaming. It's a 2-day take-home so the LLM is mocked; everything else is real distributed systems wiring."

Show the README's high-level diagram or `docs/architecture.md` §1.

## 0:30 – 1:00 — Topology (30 s)

> "What you're looking at right now is the full Compose stack: one in-Compose HyperDHT bootstrap node, one Fastify backend, three workers each on their own Hyperbee state, and an nginx serving the Vite-built React frontend. The backend is the swarm server for its own keypair; the workers join the topic as clients only — they advertise their pubkey through their RPC server's DHT instead. That single-listener split keeps RPC requests from racing two listeners on the same keypair."

Show `docker compose ps`:

```bash
docker compose ps
```

Highlight the five running services and the `dht` service's `healthy` column. Mention that `dht` runs `HyperDHT.bootstrapper(49737, ownHost)` (the documented isolated-bootstrap entrypoint) and the in-Compose default side-steps Docker bridge-NAT hairpinning (`docs/architecture.md` §4.1).

## 1:00 – 2:00 — API keys (60 s)

> "First headline feature: API key management. Plaintext is returned exactly once."

On <http://localhost:5173/keys>:

1. Type `demo` in the **Name** field → click **Create key**.
2. The green banner **"New API key — copy it now"** appears with the plaintext. Copy it.
3. The header pill flips to `key: sk-…` automatically. Dismiss the banner.
4. Show the key in the **Existing keys** table; point out that only the prefix is visible.

> "The plaintext is HMAC-hashed before storage; subsequent reads only expose the non-secret prefix. The `/v1/api-keys` management endpoints are deliberately public for the demo — chicken-and-egg — and the production hardening path is in §4 of the architecture doc."

## 2:00 – 3:30 — Streaming inference + cancellation (90 s)

> "Second headline feature: OpenAI-compatible streaming inference."

On <http://localhost:5173/playground>:

1. Send a prompt like `Write a haiku about distributed systems.` → tokens stream into the **Response** card.
2. Open Chrome DevTools → **Network** → click `completions` → **EventStream** tab to show the raw SSE.
3. Send a longer prompt like `Explain Hyperswarm in detail.` → click **Stop** mid-stream.
4. Point out that the response card now shows the partial text and the dashboard's `cancelled` counter ticks up.

> "The interesting part is what happens on Stop. The browser's AbortController fires, the backend dispatcher closes the Protomux channel, the worker's generator observes the close and emits `finishReason: 'cancelled'` — the cancellation propagates the whole way down. Architecture doc §2.6.2 has the sequence diagram."

## 3:30 – 4:00 — Dashboard + telemetry (30 s)

On <http://localhost:5173/dashboard>:

> "Telemetry is in-memory: counters, latency percentiles from a fixed-size ring buffer, and worker gauges from the live registry. JSON snapshot at `/metrics`, per-key usage at `/v1/usage/me`."

Highlight in order:

1. **Health banner** — green "Healthy" with `peers connected: 3`.
2. **Workers connected: 3, capacity: 12** (3 × `WORKER_CAPACITY=4`).
3. **Successful** — counter for stop / length finish reasons; hint shows `cancelled` from the previous step.
4. **Latency p95** — sourced from the ring buffer.
5. **Your usage** — totals + most recent minutely windows for the active key.

## 4:00 – 4:30 — Swagger + repo tour (30 s)

Tab to <http://localhost:3000/docs> for ~10 s:

> "Every route is OpenAPI-documented with TypeBox; the Inference tag describes both the streaming and non-streaming variants, and the API Keys tag explicitly calls out that the management endpoints are intentionally public for the demo."

Tab to the editor for ~20 s. Show:

- `apps/backend/src/p2p/dispatcher.ts` (one-retry path, least-in-flight selection).
- `apps/worker/src/runtime/stream-channel.ts` (Protomux substream, AbortSignal cancellation).
- `packages/shared/src/schemas/inference-response.schema.ts` (Compact Encoding tagged union — `chunk` vs `final`).

## 4:30 – 5:00 — Trade-offs + close (30 s)

> "Three trade-offs worth calling out.
> One: we use Hyperbee directly, not HyperDB. The brief names HyperDB but `hyperdb@6.x` is a schema-first document database with codegen — wrong tool for our generic key/JSON workload. There's a runnable awareness demo under `apps/backend/scripts/hyperdb-demo` that exercises HyperDB end-to-end; the architecture doc §2.4 has the reasoning.
> Two: rate-limit and metrics are in-memory; counters reset on restart. Production swap is Redis or Hyperbee.
> Three: signed result envelopes, Mark-and-Sweep GC, and Fork-ID truncate handling are deliberately out of scope; documented under §6."

> "On reliability: there's a `/ready` endpoint that returns 503 until the swarm forms, a 30-second discovery watchdog that prints an actionable checklist if peers don't show up, fail-fast config validation that catches the .env.example placeholder traps, and a `pnpm compose:smoke` script that brings everything up and asserts peers=3 + streaming `[DONE]` end-to-end — same script runs in CI behind a label."

> "Thanks for watching."

## Recording tips

- **Pre-flight checklist** before hitting record:
  - All four browser tabs reachable (no spinners).
  - DevTools open on the Playground tab, **Network** tab pre-selected, **Preserve log** on.
  - Editor on `docs/architecture.md` so you can scroll to the relevant section live.
  - Terminal sized to fit `docker compose ps` and a few log lines.
- **Failure recovery**: if a streaming response stalls, click **Clear** and **Send** again — the worker is deterministic per `jobId` so the second attempt looks the same. The dashboard polls every 5 s, so wait for the next tick after a counter-driving action.
- **Time budget**: 5 minutes is tight. Practice once at 1× before recording; cut the §4.0–4.30 repo-tour beats first if you're running long.

---

## Exporting `architecture.md` to `architecture.pdf`

The brief asks for a PDF artefact. Markdown is the source of truth (`docs/architecture.md`); the PDF is a derived export. Three options, in order of fidelity:

### Option 1 — VSCode "Markdown PDF" extension (easiest)

```text
1. Install the extension: ext install yzane.markdown-pdf
2. Open docs/architecture.md
3. Cmd-Shift-P → "Markdown PDF: Export (pdf)"
4. Output lands at docs/architecture.pdf
```

The extension renders Mermaid diagrams via headless Chromium, so §2.6.1 / §2.6.2 / §2.6.3 sequence diagrams + the state machine survive.

### Option 2 — Pandoc + LaTeX

````bash
brew install pandoc
brew install --cask basictex   # or full mactex if you want the binary footprint

# Mermaid diagrams need a separate render step; install mermaid-cli + a tiny Lua filter,
# then run pandoc with the --filter flag. Without that, fenced ```mermaid blocks become
# verbatim source in the PDF.

pandoc docs/architecture.md \
  -o docs/architecture.pdf \
  --pdf-engine=xelatex \
  --toc --toc-depth=3 \
  -V geometry:margin=1in
````

### Option 3 — Marked 2 (Mac, paid)

The path of least resistance if you already own it: open `docs/architecture.md` → File → Export → PDF. Renders Mermaid out of the box and matches the live preview.

### What's expected to look slightly off in PDF

- **Mermaid diagrams** in Option 2 (Pandoc-only) without the mermaid filter render as code blocks. Use Option 1 or 3 for diagrams.
- **GitHub-flavoured tables** with right-aligned numeric columns: alignment is preserved by Pandoc / VSCode but spacing may differ slightly from GitHub's web rendering.
- **Internal anchor links** (`§4.3`) become plain text in PDF; the page-level table of contents (Pandoc `--toc`, VSCode default) compensates.
