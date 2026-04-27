// Production entrypoint. Builds the Fastify app and listens on the configured
// host/port, wiring graceful shutdown for SIGINT / SIGTERM.

import { buildApp } from './app.js';
import { loadConfig } from './config/env.config.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config });

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
