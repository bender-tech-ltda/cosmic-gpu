// API-key management endpoints (public for the take-home; production
// hardening — admin token / mTLS — is documented as a future improvement).

import {
  ApiErrorBody,
  ApiKeyCreatedResponse,
  ApiKeyList,
  CreateApiKeyBody,
  type ApiKeyCreatedResponse as ApiKeyCreatedResponseType,
  type ApiKeyList as ApiKeyListType,
} from '@cosmic/shared';
// `ApiErrorBody` is referenced by the POST `400` response slot; the DELETE
// route documents its 404 in the description (above) rather than a schema
// slot to preserve `reply.code(204).send()` ergonomics.
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { FastifyReply } from 'fastify';

export const apiKeysRoute: FastifyPluginAsyncTypebox = async (app) => {
  app.post(
    '/api-keys',
    {
      schema: {
        tags: ['API Keys'],
        summary: 'Create an API key',
        description: [
          'Generates a new API key. The `plaintext` value is returned **exactly once** and is never retrievable again — store it securely.',
          '',
          'Public for the take-home demo (no admin token required). Production hardening is captured in `docs/architecture.md` §6.',
        ].join('\n'),
        body: CreateApiKeyBody,
        response: {
          201: ApiKeyCreatedResponse,
          400: ApiErrorBody,
        },
      },
    },
    async (request, reply): Promise<ApiKeyCreatedResponseType> => {
      const { record, plaintext } = await app.apiKeys.create(request.body);
      reply.code(201);
      return {
        id: record.id,
        name: record.name,
        scopes: record.scopes,
        createdAt: record.createdAt,
        revokedAt: record.revokedAt,
        prefix: record.prefix,
        plaintext,
      };
    },
  );

  app.get(
    '/api-keys',
    {
      schema: {
        tags: ['API Keys'],
        summary: 'List API keys',
        description:
          'Returns all API keys in public-safe form (plaintext and hash are never exposed).',
        response: { 200: ApiKeyList },
      },
    },
    async (): Promise<ApiKeyListType> => {
      const data = await app.apiKeys.list();
      return { data };
    },
  );

  app.delete(
    '/api-keys/:id',
    {
      // Success returns 204 (no body); errors flow through the central error
      // handler as `ApiErrorBody`. We deliberately omit the `response` schema
      // so the TypeBox provider does not constrain `reply.code(...)` to a
      // single declared status code. The 404 ApiKeyNotFound envelope is
      // documented in `docs/architecture.md` §3 (failure scenarios).
      schema: {
        tags: ['API Keys'],
        summary: 'Revoke an API key',
        description:
          'Marks an API key as revoked. Idempotent on already-revoked keys (returns 204 either way). Subsequent inference requests with the revoked key get a 403 `ApiKeyRevoked` envelope. Returns 404 `ApiKeyNotFound` for unknown ids.',
        params: Type.Object({
          id: Type.String({
            description: 'API key id',
            examples: ['ak_a1b2c3d4'],
          }),
        }),
      },
    },
    async (request, reply): Promise<FastifyReply> => {
      await app.apiKeys.revoke(request.params.id);
      return reply.code(204).send();
    },
  );
};
