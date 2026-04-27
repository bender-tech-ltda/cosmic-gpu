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
        description:
          'Distributed GPU cloud platform with API key management and OpenAI-compatible inference.',
        version: '0.1.0',
      },
      components: {
        securitySchemes: {
          apiKey: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'sk-...',
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
