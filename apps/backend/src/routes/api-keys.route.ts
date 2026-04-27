// API-key management endpoints (public for the take-home; production
// hardening — admin token / mTLS — is documented as a future improvement).

import {
  ApiKeyCreatedResponse,
  ApiKeyList,
  CreateApiKeyBody,
  type ApiKeyCreatedResponse as ApiKeyCreatedResponseType,
  type ApiKeyList as ApiKeyListType,
} from '@cosmic/shared';
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
        description:
          'Generates a new API key. The plaintext value is returned exactly once and never again.',
        body: CreateApiKeyBody,
        response: {
          201: ApiKeyCreatedResponse,
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
      // single declared status code.
      schema: {
        tags: ['API Keys'],
        summary: 'Revoke an API key',
        description: 'Marks an API key as revoked. Idempotent on already-revoked keys.',
        params: Type.Object({
          id: Type.String({ description: 'API key id (e.g. ak_a1b2c3d4)' }),
        }),
      },
    },
    async (request, reply): Promise<FastifyReply> => {
      await app.apiKeys.revoke(request.params.id);
      return reply.code(204).send();
    },
  );
};
