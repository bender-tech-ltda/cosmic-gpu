// Wires the state layer into Fastify and ensures clean shutdown.
// Decorates `app.state` with the bootstrapped accessors + identity.

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { bootstrapState, type CosmicState } from '../state/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    state: CosmicState;
  }
}

async function statePlugin(app: FastifyInstance): Promise<void> {
  const state = await bootstrapState(app.config, app.log);
  app.decorate('state', state);

  app.addHook('onClose', async () => {
    await state.close();
  });
}

export default fp(statePlugin, { name: 'state' });
