// Typed wrapper around the shared `ApiErrorBody` envelope. Every backend
// error response (400 / 401 / 403 / 404 / 429 / 500 / 503) lands as one of
// these so consumers can pattern-match on `code` rather than parsing
// `message` strings.

import type { ApiErrorBody } from '@cosmic/shared';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly requestId: string | undefined;
  readonly details: unknown;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.statusCode = body.statusCode;
    this.code = body.code;
    this.requestId = body.requestId;
    this.details = body.details;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/**
 * Network failures and non-JSON responses surface as a synthetic envelope
 * so callers always handle a single error shape.
 */
export function networkError(cause: unknown, statusCode = 0): ApiError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return new ApiError({
    statusCode,
    code: 'NetworkError',
    message: message || 'Network request failed.',
    requestId: undefined,
  });
}
