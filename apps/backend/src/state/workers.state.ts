// Typed state accessor for the worker registry. Each record is keyed by the
// worker's hex public key so the dispatcher can look up by id directly.

import { HYPERDB_PREFIX } from '@cosmic/shared';

import type { KvStore } from './types.js';

export interface WorkerRecord {
  /** Human-readable id (e.g. `worker-1`). */
  id: string;
  /** Hex-encoded 32-byte public key — the canonical worker identifier. */
  pubKey: string;
  /** ISO timestamp of the most recent heartbeat. */
  lastSeen: string;
  /** Maximum concurrent inference jobs the worker advertises. */
  capacity: number;
  /** Current in-flight count reported by the worker. */
  inFlight: number;
  modelId: string;
}

export class WorkersState {
  constructor(private readonly kv: KvStore) {}

  private keyByPubKey(pubKey: string): string {
    return `${HYPERDB_PREFIX.worker}${pubKey}`;
  }

  async upsert(record: WorkerRecord): Promise<void> {
    await this.kv.put(this.keyByPubKey(record.pubKey), record);
  }

  async findByPubKey(pubKey: string): Promise<WorkerRecord | null> {
    return this.kv.get<WorkerRecord>(this.keyByPubKey(pubKey));
  }

  async remove(pubKey: string): Promise<void> {
    await this.kv.del(this.keyByPubKey(pubKey));
  }

  async *list(): AsyncIterable<WorkerRecord> {
    for await (const { value } of this.kv.list<WorkerRecord>(HYPERDB_PREFIX.worker)) {
      yield value;
    }
  }
}
