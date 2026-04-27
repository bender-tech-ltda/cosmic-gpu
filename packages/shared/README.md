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
├── schemas/        # Compact Encoding schemas (RPC payloads)
│   ├── inference-request.schema.ts
│   ├── inference-response.schema.ts
│   └── worker-health.schema.ts
├── dto/            # TypeBox / TypeScript DTOs (HTTP payloads)
│   ├── api-key.dto.ts
│   ├── chat-completion.dto.ts
│   └── usage.dto.ts
├── constants/      # Topics, prefixes, defaults
│   ├── topics.constants.ts
│   └── http.constants.ts
├── errors/         # Shared error codes
│   └── error-codes.constants.ts
└── index.ts        # Barrel export
```

## Authoring Rules

- DTOs must NOT be defined inside `apps/*` folders.
- Compact Encoding schemas are the source of truth for RPC. TS types are inferred or aligned with them.
- Schema evolution is **append-only** — never reorder or remove fields.

## Consumers

```ts path=null start=null
import { CHAT_COMPLETION_REQUEST_SCHEMA } from '@cosmic/shared/schemas';
import { ChatCompletionRequest } from '@cosmic/shared/dto';
import { GPU_DISCOVERY_TOPIC } from '@cosmic/shared/constants';
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
