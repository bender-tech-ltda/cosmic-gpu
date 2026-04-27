import { API_KEY_PREFIX, ERROR_CODE } from '@cosmic/shared';
import { describe, expect, it } from 'vitest';

import { isDomainError, type DomainError } from '../errors/domain-error.js';
import {
  extractPrefix,
  generateApiKeyPlaintext,
  hashApiKey,
  parseBearer,
  safeHashEqual,
} from './api-key.crypto.js';

describe('generateApiKeyPlaintext', () => {
  it('starts with the configured prefix', () => {
    expect(generateApiKeyPlaintext().startsWith(API_KEY_PREFIX)).toBe(true);
  });

  it('produces unique values across calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generateApiKeyPlaintext());
    expect(seen.size).toBe(50);
  });

  it('only contains base64url characters after the prefix', () => {
    const body = generateApiKeyPlaintext().slice(API_KEY_PREFIX.length);
    expect(body).toMatch(/^[A-Za-z0-9\-_]+$/);
  });
});

describe('hashApiKey', () => {
  it('is deterministic for the same secret + plaintext', () => {
    expect(hashApiKey('sk-foo', 's')).toBe(hashApiKey('sk-foo', 's'));
  });

  it('changes when the secret changes', () => {
    expect(hashApiKey('sk-foo', 'a')).not.toBe(hashApiKey('sk-foo', 'b'));
  });

  it('produces a 64-char hex digest', () => {
    expect(hashApiKey('sk-foo', 'secret')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('extractPrefix', () => {
  it('returns the first 12 characters', () => {
    const out = extractPrefix('sk-AbCdEfGhIjKlMnOp');
    expect(out).toBe('sk-AbCdEfGhI');
    expect(out.length).toBe(12);
  });
});

describe('safeHashEqual', () => {
  it('returns true for identical hex digests', () => {
    const h = hashApiKey('sk-foo', 's');
    expect(safeHashEqual(h, h)).toBe(true);
  });

  it('returns false for different hex digests of equal length', () => {
    expect(safeHashEqual(hashApiKey('a', 's'), hashApiKey('b', 's'))).toBe(false);
  });

  it('returns false when lengths differ', () => {
    expect(safeHashEqual('abcd', 'abcdef')).toBe(false);
  });

  it('returns false when both inputs are empty', () => {
    expect(safeHashEqual('', '')).toBe(false);
  });
});

describe('parseBearer', () => {
  it('extracts the token from a valid header', () => {
    expect(parseBearer('Bearer sk-foo')).toBe('sk-foo');
  });

  it('is case-insensitive on the scheme', () => {
    expect(parseBearer('bearer sk-foo')).toBe('sk-foo');
  });

  it('throws apiKeyMissing when the header is undefined', () => {
    try {
      parseBearer(undefined);
      throw new Error('parseBearer should have thrown');
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as DomainError).code).toBe(ERROR_CODE.apiKeyMissing);
      expect((err as DomainError).statusCode).toBe(401);
    }
  });

  it('throws apiKeyMissing for an empty string', () => {
    try {
      parseBearer('   ');
      throw new Error('parseBearer should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe(ERROR_CODE.apiKeyMissing);
    }
  });

  it('throws apiKeyInvalid for the wrong scheme', () => {
    try {
      parseBearer('Basic dXNlcjpwYXNz');
      throw new Error('parseBearer should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe(ERROR_CODE.apiKeyInvalid);
    }
  });

  it('throws apiKeyInvalid for a missing token', () => {
    try {
      parseBearer('Bearer');
      throw new Error('parseBearer should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe(ERROR_CODE.apiKeyInvalid);
    }
  });

  it('throws apiKeyInvalid for extra tokens after the bearer value', () => {
    try {
      parseBearer('Bearer sk-foo extra');
      throw new Error('parseBearer should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe(ERROR_CODE.apiKeyInvalid);
    }
  });
});
