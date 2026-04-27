// Echoes the request id back as `x-request-id` so clients (and logs) can
// correlate. Fastify already generates one if the inbound header is missing
// (we configure that generator in app.ts).

import { REQUEST_ID_HEADER } from '@cosmic/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

async function requestIdPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onSend', async (request, reply, payload) => {
    reply.header(REQUEST_ID_HEADER, request.id);
    return payload;
  });
}

export default fp(requestIdPlugin, { name: 'request-id' });
