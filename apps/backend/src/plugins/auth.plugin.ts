// Bearer-token authentication plugin.
// Decorates the app with:
//   - `app.apiKeys` — the `ApiKeysService` instance shared across routes.
//   - `app.authenticate` — a `preHandler` that resolves the request's bearer
//     token, validates it, and populates `request.apiKey`.
//
// Routes opt in by adding `{ preHandler: app.authenticate }` to their
// definition. Routes that do not opt in remain unauthenticated.

import { AUTH_HEADER } from '@cosmic/shared';
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerAsyncHookHandler,
} from 'fastify';
import fp from 'fastify-plugin';

import { parseBearer } from '../auth/api-key.crypto.js';
import { ApiKeysService } from '../services/api-keys.service.js';

export interface AuthenticatedApiKey {
  id: string;
  name: string;
  scopes: string[];
  prefix: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Populated by `app.authenticate` once authentication succeeds. */
    apiKey?: AuthenticatedApiKey;
  }
  interface FastifyInstance {
    apiKeys: ApiKeysService;
    authenticate: preHandlerAsyncHookHandler;
  }
}

async function authPlugin(app: FastifyInstance): Promise<void> {
  const service = new ApiKeysService(app.state.apiKeys, app.config.API_KEY_HMAC_SECRET, app.log);
  app.decorate('apiKeys', service);

  const authenticate: preHandlerAsyncHookHandler = async (
    request: FastifyRequest,
    _reply: FastifyReply,
  ) => {
    const headerValue = request.headers[AUTH_HEADER];
    const plaintext = parseBearer(headerValue);
    const record = await service.authenticatePlaintext(plaintext);
    request.apiKey = {
      id: record.id,
      name: record.name,
      scopes: record.scopes,
      prefix: record.prefix,
    };
  };

  app.decorate('authenticate', authenticate);
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['state'],
});
