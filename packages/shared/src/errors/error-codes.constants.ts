/**
 * Stable error codes returned by the platform API. The HTTP error envelope
 * (`ApiErrorBody`) carries the code as a string. The frontend may pattern-
 * match specific codes for UX (e.g. distinguishing "rate limited" from
 * "no workers available"). Append-only — never rename or remove a code.
 */
export const ERROR_CODE = {
  validationFailed: 'ValidationFailed',
  apiKeyMissing: 'ApiKeyMissing',
  apiKeyInvalid: 'ApiKeyInvalid',
  apiKeyRevoked: 'ApiKeyRevoked',
  apiKeyNotFound: 'ApiKeyNotFound',
  rateLimited: 'RateLimited',
  noWorkersAvailable: 'NoWorkersAvailable',
  workerTimeout: 'WorkerTimeout',
  inferenceCancelled: 'InferenceCancelled',
  internalError: 'InternalError',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];
