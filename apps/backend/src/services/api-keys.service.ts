// Application service that owns the API-key lifecycle.
// It composes the typed `ApiKeysState` accessor with the crypto helpers
// (hashing, plaintext generation) and translates failures into `DomainError`s
// so the central error handler can serialize them into `ApiErrorBody`.

import type { ApiKey } from '@cosmic/shared';
import { ERROR_CODE } from '@cosmic/shared';
import { randomBytes } from 'node:crypto';

import {
  extractPrefix,
  generateApiKeyPlaintext,
  hashApiKey,
  safeHashEqual,
} from '../auth/api-key.crypto.js';
import { DomainError } from '../errors/domain-error.js';
import type { ApiKeyRecord, ApiKeysState } from '../state/api-keys.state.js';

export interface CreateApiKeyInput {
  name: string;
  scopes?: string[];
}

export interface CreateApiKeyResult {
  record: ApiKeyRecord;
  plaintext: string;
}

const DEFAULT_SCOPES: readonly string[] = ['inference:read'];

function generateId(): string {
  return `ak_${randomBytes(8).toString('hex')}`;
}

/**
 * Project a stored record onto the public-safe DTO shape (drops `keyHash`).
 */
export function publicApiKey(record: ApiKeyRecord): ApiKey {
  return {
    id: record.id,
    name: record.name,
    scopes: record.scopes,
    createdAt: record.createdAt,
    revokedAt: record.revokedAt,
    prefix: record.prefix,
  };
}

export class ApiKeysService {
  constructor(
    private readonly state: ApiKeysState,
    private readonly hmacSecret: string,
  ) {}

  async create(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
    const plaintext = generateApiKeyPlaintext();
    const record: ApiKeyRecord = {
      id: generateId(),
      name: input.name,
      keyHash: hashApiKey(plaintext, this.hmacSecret),
      prefix: extractPrefix(plaintext),
      scopes: input.scopes ?? [...DEFAULT_SCOPES],
      createdAt: new Date().toISOString(),
      revokedAt: null,
    };
    await this.state.create(record);
    return { record, plaintext };
  }

  async list(): Promise<ApiKey[]> {
    const out: ApiKey[] = [];
    for await (const record of this.state.list()) {
      out.push(publicApiKey(record));
    }
    // Most recent first; stable for ties.
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return out;
  }

  /**
   * Revokes a key by id. Throws `apiKeyNotFound` when the id is unknown.
   * Idempotent on already-revoked records.
   */
  async revoke(id: string): Promise<ApiKeyRecord> {
    const existing = await this.state.findById(id);
    if (!existing) {
      throw new DomainError({
        statusCode: 404,
        code: ERROR_CODE.apiKeyNotFound,
        message: `API key '${id}' was not found.`,
      });
    }
    const updated = await this.state.revoke(id);
    return updated ?? existing;
  }

  /**
   * Validates a plaintext bearer token against the persisted hashes.
   * - 401 `apiKeyInvalid` when no record matches.
   * - 403 `apiKeyRevoked` when the matched record is revoked.
   * Returns the active record on success.
   */
  async authenticatePlaintext(plaintext: string): Promise<ApiKeyRecord> {
    const expected = hashApiKey(plaintext, this.hmacSecret);
    const candidate = await this.state.findByHash(expected);
    if (!candidate || !safeHashEqual(candidate.keyHash, expected)) {
      throw new DomainError({
        statusCode: 401,
        code: ERROR_CODE.apiKeyInvalid,
        message: 'API key is not recognised.',
      });
    }
    if (candidate.revokedAt !== null) {
      throw new DomainError({
        statusCode: 403,
        code: ERROR_CODE.apiKeyRevoked,
        message: 'API key has been revoked.',
      });
    }
    return candidate;
  }
}
