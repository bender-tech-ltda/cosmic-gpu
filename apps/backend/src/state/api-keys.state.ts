// Typed state accessor for API keys. Stores hashed records under
// `api-keys/<id>` so the plaintext is never persisted.

import { HYPERDB_PREFIX } from '@cosmic/shared';

import type { KvStore } from './types.js';

export interface ApiKeyRecord {
  id: string;
  name: string;
  /** HMAC-SHA-256 of the plaintext key. */
  keyHash: string;
  /** First 8 chars of the plaintext (UI hint only). */
  prefix: string;
  scopes: string[];
  createdAt: string;
  /** ISO timestamp of revocation, or null when active. */
  revokedAt: string | null;
}

export class ApiKeysState {
  constructor(private readonly kv: KvStore) {}

  private keyById(id: string): string {
    return `${HYPERDB_PREFIX.apiKey}${id}`;
  }

  async create(record: ApiKeyRecord): Promise<void> {
    await this.kv.put(this.keyById(record.id), record);
  }

  async findById(id: string): Promise<ApiKeyRecord | null> {
    return this.kv.get<ApiKeyRecord>(this.keyById(id));
  }

  /**
   * Linear scan over the api-keys prefix. Acceptable for the demo's small
   * key set; production would maintain a secondary index keyed by hash.
   */
  async findByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    for await (const { value } of this.kv.list<ApiKeyRecord>(HYPERDB_PREFIX.apiKey)) {
      if (value.keyHash === keyHash) return value;
    }
    return null;
  }

  async revoke(id: string, at: string = new Date().toISOString()): Promise<ApiKeyRecord | null> {
    const existing = await this.findById(id);
    if (!existing || existing.revokedAt) return existing;
    const updated: ApiKeyRecord = { ...existing, revokedAt: at };
    await this.kv.put(this.keyById(id), updated);
    return updated;
  }

  async *list(): AsyncIterable<ApiKeyRecord> {
    for await (const { value } of this.kv.list<ApiKeyRecord>(HYPERDB_PREFIX.apiKey)) {
      yield value;
    }
  }
}
