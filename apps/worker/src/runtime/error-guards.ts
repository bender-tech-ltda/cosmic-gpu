// Top-level guards for Hyperswarm / HyperDHT peer-stream errors.
//
// Mirrors `apps/backend/src/p2p/error-guards.ts`; see that file's header
// for the full rationale. The two diverge only in the logger type (Pino
// here vs Fastify's logger in the backend).

import type { Logger } from 'pino';

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

let installed = false;

export function installP2pErrorGuards(log: Logger): void {
  if (installed) return;
  installed = true;

  process.on('uncaughtException', (err) => {
    if (isPeerStreamError(err)) {
      log.warn({ err }, 'p2p.peer_stream_error');
      return;
    }
    log.fatal({ err }, 'process.uncaught_exception');
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
