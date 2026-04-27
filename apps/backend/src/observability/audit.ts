// Audit-event helper.
//
// The observability rule (`.cursor/rules/observability.mdc`) requires that
// significant lifecycle events emit structured Pino lines with a stable
// `event` field. Centralising that convention here means we can later swap
// the implementation (e.g. tee to a Hypercore audit feed) without touching
// every call site.
//
// Usage:
//   import { logEvent, type AuditEvent } from '../observability/audit.js';
//   logEvent(app.log, 'api-key.created', { apiKeyId, prefix });
//
// Append-only convention: never rename or remove an event name.

import type { FastifyBaseLogger } from 'fastify';

export const AUDIT_EVENT = {
  apiKeyCreated: 'api-key.created',
  apiKeyRevoked: 'api-key.revoked',
  workerJoined: 'worker.joined',
  workerLeft: 'worker.left',
  inferenceDispatched: 'inference.dispatched',
  inferenceCompleted: 'inference.completed',
  inferenceFailed: 'inference.failed',
} as const;

export type AuditEvent = (typeof AUDIT_EVENT)[keyof typeof AUDIT_EVENT];

/**
 * Minimal logger surface we need from the helper. Accepting this narrowed
 * shape (instead of `FastifyBaseLogger`) makes unit-testing trivial \u2014 a
 * plain `{ info: vi.fn() }` object is enough.
 */
export interface AuditLogger {
  info: FastifyBaseLogger['info'];
}

/**
 * Emit a single structured audit log line. The `event` field is always set
 * first so log filters can scan for `event=*` cheaply.
 */
export function logEvent(
  log: AuditLogger,
  event: AuditEvent,
  fields: Record<string, unknown> = {},
): void {
  log.info({ event, ...fields }, event);
}
