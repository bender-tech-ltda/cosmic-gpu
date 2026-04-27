// Standalone Pino logger for the worker.
//
// Mirrors the redact paths configured in `apps/backend/src/app.ts` so that
// secrets / prompt content / one-time plaintext keys never land in the
// structured logs. Also exposes a tiny `logEvent` helper so worker code uses
// the same `event=*` convention as the backend's `AUDIT_EVENT` map.

import pino, { type Logger } from 'pino';

import type { WorkerConfig } from '../config/env.config.js';

export const WORKER_AUDIT_EVENT = {
  workerJoined: 'worker.joined',
  workerLeft: 'worker.left',
  inferenceDispatched: 'inference.dispatched',
  inferenceCompleted: 'inference.completed',
  inferenceFailed: 'inference.failed',
} as const;

export type WorkerAuditEvent = (typeof WORKER_AUDIT_EVENT)[keyof typeof WORKER_AUDIT_EVENT];

const REDACT_PATHS: string[] = [
  'authorization',
  'headers.authorization',
  'plaintext',
  'apiKey.plaintext',
  'request.messages[*].content',
  'body.messages[*].content',
  'messages[*].content',
];

export function buildLogger(config: WorkerConfig): Logger {
  const isDev = config.NODE_ENV === 'development';
  return pino({
    level: config.WORKER_LOG_LEVEL,
    base: { service: 'worker', workerId: config.WORKER_ID },
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    transport: isDev
      ? { target: 'pino-pretty', options: { translateTime: 'SYS:standard' } }
      : undefined,
  });
}

export interface WorkerAuditLogger {
  info: Logger['info'];
}

/** Emit a single structured audit log line with a stable `event` field. */
export function logEvent(
  log: WorkerAuditLogger,
  event: WorkerAuditEvent,
  fields: Record<string, unknown> = {},
): void {
  log.info({ event, ...fields }, event);
}
