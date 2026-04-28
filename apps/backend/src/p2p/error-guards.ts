// Top-level guards for Hyperswarm / HyperDHT peer-stream errors.
//
// Per the Holepunch maintainers (see hyperswarm#45 + hyperswarm-dht#61),
// every NoiseSecretStream emits `'error'` when its remote side resets,
// times out, or drops mid-handshake. Node's EventEmitter contract:
// an unhandled `'error'` terminates the process. Application code is
// expected to attach a handler to every peer stream it owns.
//
// We attach per-stream handlers in `p2p/swarm.ts` (`swarm.on('connection',
// conn => conn.on('error'))`) and `p2p/stream-transport.ts`. But the
// `@hyperswarm/rpc` library opens its own `dht.connect()` / `dht.createServer()`
// streams internally for each request and we don't get a hook to attach a
// handler to those. This module is the safety net for those escaped errors.

import type { FastifyBaseLogger } from 'fastify';

const NOISE_STREAM_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ECANCELED']);
const NOISE_STREAM_ERROR_MESSAGES = [
  'connection reset by peer',
  'connection timed out',
  'connect aborted',
  'channel destroyed',
  'duplicate connection',
];

interface MaybeStreamError {
  code?: unknown;
  message?: unknown;
}

function isPeerStreamError(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  const candidate = err as MaybeStreamError;
  if (typeof candidate.code === 'string' && NOISE_STREAM_ERROR_CODES.has(candidate.code)) {
    return true;
  }
  if (typeof candidate.message === 'string') {
    const msg = candidate.message.toLowerCase();
    return NOISE_STREAM_ERROR_MESSAGES.some((needle) => msg.includes(needle));
  }
  return false;
}

/**
 * Install `process.on('uncaughtException')` and `process.on('unhandledRejection')`
 * filters that downgrade peer-stream errors to a `warn` log and keep the
 * process alive. Anything else is logged at `fatal` and re-thrown.
 *
 * Idempotent: calling twice in the same process is a no-op the second time.
 */
let installed = false;

export function installP2pErrorGuards(log: FastifyBaseLogger): void {
  if (installed) return;
  installed = true;

  process.on('uncaughtException', (err) => {
    if (isPeerStreamError(err)) {
      log.warn({ err }, 'p2p.peer_stream_error');
      return;
    }
    log.fatal({ err }, 'process.uncaught_exception');
    // Re-throw so existing crash semantics (test harness, supervisors) still
    // see a non-zero exit for genuine bugs.
    setTimeout(() => {
      throw err;
    }, 0);
  });

  process.on('unhandledRejection', (reason) => {
    if (isPeerStreamError(reason)) {
      log.warn({ err: reason }, 'p2p.peer_stream_rejection');
      return;
    }
    log.error({ err: reason }, 'process.unhandled_rejection');
  });
}

/** Test seam — clear the install latch between tests. */
export function __resetP2pErrorGuards(): void {
  installed = false;
}
