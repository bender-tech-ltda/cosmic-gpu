// Typed state accessor for the worker registry. Each record is keyed by the
// worker's hex public key so the dispatcher can look up by id directly.
//
// In addition to the KV-backed records (the source of truth), the state
// maintains a tiny in-memory mirror of `pubKey -> capacity` so the metrics
// gauge can read the cluster-wide capacity sum synchronously. Reading the
// KV store would require an async iteration, which doesn't fit the gauge's
// synchronous contract — see `bootstrapP2p` in `apps/backend/src/p2p/index.ts`.

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
  /**
   * In-memory mirror of `pubKey -> capacity`. Updated by `upsert`/`remove`
   * and seeded by `hydrate()` from the KV at bootstrap so the metrics gauge
   * has a synchronous, accurate value across restarts.
   */
  private readonly capacityByPubKey = new Map<string, number>();
  private capacityTotal = 0;

  constructor(private readonly kv: KvStore) {}

  private keyByPubKey(pubKey: string): string {
    return `${HYPERDB_PREFIX.worker}${pubKey}`;
  }

  async upsert(record: WorkerRecord): Promise<void> {
    const previous = this.capacityByPubKey.get(record.pubKey) ?? 0;
    this.capacityByPubKey.set(record.pubKey, record.capacity);
    this.capacityTotal += record.capacity - previous;
    await this.kv.put(this.keyByPubKey(record.pubKey), record);
  }

  async findByPubKey(pubKey: string): Promise<WorkerRecord | null> {
    return this.kv.get<WorkerRecord>(this.keyByPubKey(pubKey));
  }

  async remove(pubKey: string): Promise<void> {
    const previous = this.capacityByPubKey.get(pubKey);
    if (previous !== undefined) {
      this.capacityByPubKey.delete(pubKey);
      this.capacityTotal -= previous;
    }
    await this.kv.del(this.keyByPubKey(pubKey));
  }

  async *list(): AsyncIterable<WorkerRecord> {
    for await (const { value } of this.kv.list<WorkerRecord>(HYPERDB_PREFIX.worker)) {
      yield value;
    }
  }

  /**
   * Synchronous capacity gauge for `MetricsRegistry.attachWorkerGauges`.
   * Reads from the in-memory mirror — the KV is not iterated here.
   */
  totalCapacity(): number {
    return this.capacityTotal;
  }

  /**
   * One-shot async iterate over the KV to seed `capacityByPubKey` /
   * `capacityTotal`. Intended to run once during `bootstrapState()` so the
   * gauge is correct even before the first health poll lands.
   */
  async hydrate(): Promise<void> {
    this.capacityByPubKey.clear();
    this.capacityTotal = 0;
    for await (const record of this.list()) {
      this.capacityByPubKey.set(record.pubKey, record.capacity);
      this.capacityTotal += record.capacity;
    }
  }
}
