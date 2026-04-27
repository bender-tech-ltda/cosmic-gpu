// Typed state accessor for per-key usage windows. Records are keyed by
// `usage/<apiKeyId>/<windowStart>` so a prefix scan returns one key's history
// efficiently.

import { HYPERDB_PREFIX } from '@cosmic/shared';

import type { KvStore } from './types.js';

export interface UsageRecord {
  apiKeyId: string;
  /** ISO timestamp marking the start of the window. */
  windowStart: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
}

export interface UsageDelta {
  requests?: number;
  promptTokens?: number;
  completionTokens?: number;
}

export class UsageState {
  constructor(private readonly kv: KvStore) {}

  private keyFor(apiKeyId: string, windowStart: string): string {
    return `${HYPERDB_PREFIX.usage}${apiKeyId}/${windowStart}`;
  }

  private prefixForKey(apiKeyId: string): string {
    return `${HYPERDB_PREFIX.usage}${apiKeyId}/`;
  }

  async upsert(record: UsageRecord): Promise<void> {
    await this.kv.put(this.keyFor(record.apiKeyId, record.windowStart), record);
  }

  async get(apiKeyId: string, windowStart: string): Promise<UsageRecord | null> {
    return this.kv.get<UsageRecord>(this.keyFor(apiKeyId, windowStart));
  }

  /** Atomically merges deltas into the window record (creating it if absent). */
  async incrementCounter(
    apiKeyId: string,
    windowStart: string,
    deltas: UsageDelta,
  ): Promise<UsageRecord> {
    const existing = await this.get(apiKeyId, windowStart);
    const merged: UsageRecord = {
      apiKeyId,
      windowStart,
      requests: (existing?.requests ?? 0) + (deltas.requests ?? 0),
      promptTokens: (existing?.promptTokens ?? 0) + (deltas.promptTokens ?? 0),
      completionTokens: (existing?.completionTokens ?? 0) + (deltas.completionTokens ?? 0),
    };
    await this.kv.put(this.keyFor(apiKeyId, windowStart), merged);
    return merged;
  }

  async *listForKey(apiKeyId: string): AsyncIterable<UsageRecord> {
    for await (const { value } of this.kv.list<UsageRecord>(this.prefixForKey(apiKeyId))) {
      yield value;
    }
  }
}
