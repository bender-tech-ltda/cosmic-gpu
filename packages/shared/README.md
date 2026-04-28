# `@cosmic/shared` — Cross-Process Contracts

The single source of truth for everything that crosses process boundaries in the Cosmic GPU cloud:

- **Compact Encoding schemas** — binary serialization for Hyperswarm RPC payloads.
- **TypeBox / TypeScript DTOs** — used by Fastify validation and the React frontend.
- **Topic constants** — the 32-byte Hyperswarm discovery topic.
- **Error codes** — shared between backend and frontend.

## Why a Shared Package?

Per [`p2p-architecture.mdc`](../../.cursor/rules/p2p-architecture.mdc), Compact Encoding is **mandatory** for inter-process RPC. Centralizing schemas here ensures backend and worker speak exactly the same wire format and prevents type drift between backend and frontend.

## Project Structure

```
src/
├── schemas/        # Compact Encoding codecs (RPC payloads)
│   ├── codec.helpers.ts            # defineObject / array / optional / taggedUnion
│   ├── inference-request.schema.ts # inferenceRequestCodec
│   ├── inference-response.schema.ts# inferenceResponseCodec (chunk | final tagged union)
│   └── worker-health.schema.ts     # workerHealthCodec
├── dto/            # TypeBox / TypeScript DTOs (HTTP payloads)
│   ├── api-key.dto.ts
│   ├── chat-completion.dto.ts
│   ├── error.dto.ts
│   ├── health.dto.ts
│   ├── metrics.dto.ts
│   ├── model.dto.ts
│   └── usage.dto.ts
├── constants/      # Topics, HTTP, RPC method names, Hyperbee key prefixes
│   ├── http.constants.ts
│   ├── hyperdb-keys.constants.ts   # HYPERDB_PREFIX (api-keys/, workers/, jobs/, usage/)
│   ├── rpc.constants.ts            # RPC_METHOD names
│   └── topics.constants.ts         # DEFAULT_DISCOVERY_TOPIC + decodeDiscoveryTopic
├── errors/         # Shared error codes
│   └── error-codes.constants.ts    # ERROR_CODE union
└── index.ts        # Top-level barrel
```

## Authoring Rules

- DTOs must NOT be defined inside `apps/*` folders.
- Compact Encoding schemas are the source of truth for RPC. TS types are inferred or aligned with them.
- Schema evolution is **append-only** — never reorder or remove fields.

## Consumers

```ts path=null start=null
import { inferenceRequestCodec, inferenceResponseCodec } from '@cosmic/shared/schemas';
import { ChatCompletionRequest, MetricsResponse } from '@cosmic/shared/dto';
import { DEFAULT_DISCOVERY_TOPIC, RPC_METHOD } from '@cosmic/shared/constants';
// or, from the top-level barrel (errors are only re-exported here):
import { ERROR_CODE } from '@cosmic/shared';
```

## Scripts

```bash
pnpm --filter @cosmic/shared build       # tsc → dist/
pnpm --filter @cosmic/shared dev         # tsc --watch
pnpm --filter @cosmic/shared test
pnpm --filter @cosmic/shared lint
pnpm --filter @cosmic/shared typecheck
```

## Related Rules

- [`project-structure.mdc`](../../.cursor/rules/project-structure.mdc)
- [`p2p-architecture.mdc`](../../.cursor/rules/p2p-architecture.mdc)
- [`api-documentation.mdc`](../../.cursor/rules/api-documentation.mdc)
- [`naming-conventions.mdc`](../../.cursor/rules/naming-conventions.mdc)
