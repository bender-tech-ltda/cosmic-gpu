// Wires the P2P module into Fastify and ensures clean shutdown.
// Decorates `app.p2p` with the bootstrapped swarm + dispatcher.

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { bootstrapP2p, type CosmicP2p } from '../p2p/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    p2p: CosmicP2p;
  }
}

async function p2pPlugin(app: FastifyInstance): Promise<void> {
  const p2p = await bootstrapP2p({
    config: app.config,
    state: app.state,
    log: app.log,
    metrics: app.metrics,
  });
  app.decorate('p2p', p2p);

  app.addHook('onClose', async () => {
    await p2p.close();
  });
}

export default fp(p2pPlugin, {
  name: 'p2p',
  dependencies: ['state', 'auth', 'metrics'],
});
