import { describe, expect, it } from 'vitest';

import { ApiError, isApiError, networkError } from './api-error.js';

describe('ApiError', () => {
  it('exposes the envelope fields and the underlying message', () => {
    const err = new ApiError({
      statusCode: 401,
      code: 'ApiKeyInvalid',
      message: 'Invalid bearer.',
      requestId: 'req_123',
    });
    expect(err.message).toBe('Invalid bearer.');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('ApiKeyInvalid');
    expect(err.requestId).toBe('req_123');
    expect(err.name).toBe('ApiError');
    expect(isApiError(err)).toBe(true);
  });

  it('preserves details when present', () => {
    const err = new ApiError({
      statusCode: 400,
      code: 'ValidationFailed',
      message: 'bad body',
      details: [{ path: 'foo' }],
    });
    expect(err.details).toEqual([{ path: 'foo' }]);
  });

  it('isApiError returns false for non-ApiError values', () => {
    expect(isApiError(new Error('plain'))).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError({ code: 'oops' })).toBe(false);
  });
});

describe('networkError', () => {
  it('synthesises an envelope from an Error', () => {
    const err = networkError(new Error('boom'), 503);
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('NetworkError');
    expect(err.message).toBe('boom');
  });

  it('falls back to a generic message when given non-Error', () => {
    const err = networkError({});
    expect(err.code).toBe('NetworkError');
    expect(err.message.length).toBeGreaterThan(0);
  });
});
