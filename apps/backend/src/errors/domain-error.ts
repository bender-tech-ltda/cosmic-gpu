import type { ErrorCode } from '@cosmic/shared';

/**
 * Base class for predictable, HTTP-mapped domain errors.
 * Services throw subclasses (or `DomainError` directly) and the central
 * Fastify error handler converts them into `ApiErrorBody` envelopes with the
 * matching `statusCode` + `code`.
 */
export class DomainError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(opts: { statusCode: number; code: ErrorCode; message: string; details?: unknown }) {
    super(opts.message);
    this.name = 'DomainError';
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    this.details = opts.details;
  }
}

/** Type guard so the error handler can narrow safely. */
export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}
