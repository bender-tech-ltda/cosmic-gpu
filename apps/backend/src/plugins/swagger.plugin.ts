import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * OpenAPI generation + Swagger UI at `/docs`.
 * Routes opt into the `apiKey` security scheme by adding
 * `security: [{ apiKey: [] }]` to their schema.
 */
async function swaggerPlugin(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Cosmic GPU Cloud API',
        description: [
          'Distributed GPU cloud platform with API key management and OpenAI-compatible inference.',
          '',
          'See `docs/architecture.md` in the repository for the design, distributed approach,',
          'failure scenarios, and trade-offs. The OpenAI-compatible streaming endpoint serves',
          'Server-Sent Events; Swagger UI cannot render SSE bodies, so use `curl` or the',
          'frontend Playground page (`/playground`) to exercise streaming end-to-end.',
        ].join('\n'),
        version: '0.1.0',
      },
      tags: [
        {
          name: 'Health',
          description:
            'Liveness probe used by container orchestrators. Reports the live P2P peer count alongside the basic `status: "ok"`.',
        },
        {
          name: 'Telemetry',
          description:
            'In-memory metrics snapshot. Counters reset on backend restart — trade-off documented in `docs/architecture.md` §4.3.',
        },
        {
          name: 'API Keys',
          description:
            'Create / list / revoke bearer keys. Plaintext is returned **exactly once** at creation; subsequent reads only expose a non-secret prefix. Management endpoints are deliberately **public** for the take-home demo (chicken-and-egg) — see `docs/architecture.md` §4 for the production hardening path.',
        },
        {
          name: 'Models',
          description:
            'List the model ids served by the connected worker pool. Falls back to `mock-llm` when no worker has reported yet.',
        },
        {
          name: 'Inference',
          description:
            'OpenAI-compatible chat completions. `stream: false` returns a `ChatCompletion`; `stream: true` returns Server-Sent Events terminated with `data: [DONE]\\n\\n`.',
        },
        {
          name: 'Usage',
          description:
            'Per-API-key usage summary for the authenticated caller. Aggregates totals + the most recent windows from `UsageState`.',
        },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'sk-...',
            description:
              'API key minted via `POST /v1/api-keys`. The plaintext value is shown exactly once at creation; copy it then.',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });
}

export default fp(swaggerPlugin, { name: 'swagger' });
