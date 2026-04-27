// Cryptographic helpers for API keys.
// Plaintexts are generated, surfaced once, and never persisted. We keep an
// HMAC-SHA-256 hash of the plaintext (using `API_KEY_HMAC_SECRET`) for
// authentication.

import { API_KEY_PREFIX, ERROR_CODE } from '@cosmic/shared';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { DomainError } from '../errors/domain-error.js';

/** Random body length, in bytes. 32 bytes → 43 base64url chars. */
const KEY_BYTES = 32;
/** Number of leading characters surfaced as the public-safe prefix hint. */
const PREFIX_HINT_LENGTH = 12;

/**
 * Generate a fresh plaintext API key. Format: `sk-<base64url(32 random bytes)>`.
 * Returned exactly once at creation; never persisted.
 */
export function generateApiKeyPlaintext(): string {
  return `${API_KEY_PREFIX}${randomBytes(KEY_BYTES).toString('base64url')}`;
}

/**
 * HMAC-SHA-256 of the plaintext, hex-encoded. Deterministic for a fixed
 * `secret` (the `API_KEY_HMAC_SECRET` env var).
 */
export function hashApiKey(plaintext: string, secret: string): string {
  return createHmac('sha256', secret).update(plaintext).digest('hex');
}

/** Public-safe display hint stored on the record (e.g. `sk-AbCdEfGh`). */
export function extractPrefix(plaintext: string): string {
  return plaintext.slice(0, PREFIX_HINT_LENGTH);
}

/**
 * Constant-time comparison of two hex digests. Returns false when the inputs
 * have different lengths so that information isn't leaked either.
 */
export function safeHashEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length === 0 || aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Parse an `Authorization: Bearer <token>` header and return the bare token.
 * - Missing/empty header → `apiKeyMissing` (401)
 * - Wrong scheme / no token → `apiKeyInvalid` (401)
 */
export function parseBearer(headerValue: unknown): string {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainError({
      statusCode: 401,
      code: ERROR_CODE.apiKeyMissing,
      message: 'Missing Authorization header.',
    });
  }
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer' || !parts[1]) {
    throw new DomainError({
      statusCode: 401,
      code: ERROR_CODE.apiKeyInvalid,
      message: 'Authorization header must be of the form "Bearer <api-key>".',
    });
  }
  return parts[1];
}
