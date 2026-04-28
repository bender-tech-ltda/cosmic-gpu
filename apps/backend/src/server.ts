// Production entrypoint. Builds the Fastify app and listens on the configured
// host/port, wiring graceful shutdown for SIGINT / SIGTERM.

import { buildApp } from './app.js';
import { loadConfig } from './config/env.config.js';
import { installP2pErrorGuards } from './p2p/error-guards.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config });

  // Hyperswarm peer streams emit `'error'` events whenever a remote peer
  // resets / times out the Noise handshake. The Holepunch maintainers
  // explicitly require that consumers attach handlers to every stream
  // (see hyperswarm#45 and hyperswarm-dht#61). The per-stream handlers we
  // install in `p2p/swarm.ts` and `p2p/stream-transport.ts` cover the
  // streams we own; this top-level guard catches anything that escapes
  // (e.g. from `@hyperswarm/rpc`'s internal client/server streams).
  installP2pErrorGuards(app.log);

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      app.log.info({ signal }, 'shutdown.start');
      app
        .close()
        .then(() => {
          app.log.info('shutdown.done');
          process.exit(0);
        })
        .catch((err) => {
          app.log.error({ err }, 'shutdown.error');
          process.exit(1);
        });
    });
  }

  try {
    await app.listen({ host: config.BACKEND_HOST, port: config.BACKEND_PORT });
  } catch (err) {
    app.log.error({ err }, 'failed to start');
    process.exit(1);
  }
}

void main();
