// Typed state accessor for inference jobs. Each lifecycle transition rewrites
// the same record (Hyperbee handles the append-only log under the hood).

import { HYPERDB_PREFIX } from '@cosmic/shared';

import type { KvStore } from './types.js';

export type JobStatus = 'pending' | 'dispatched' | 'running' | 'complete' | 'failed';

export interface JobRecord {
  id: string;
  apiKeyId: string;
  workerPubKey: string | null;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  tokensIn: number | null;
  tokensOut: number | null;
}

export class JobsState {
  constructor(private readonly kv: KvStore) {}

  private keyById(id: string): string {
    return `${HYPERDB_PREFIX.job}${id}`;
  }

  async create(record: JobRecord): Promise<void> {
    await this.kv.put(this.keyById(record.id), record);
  }

  async findById(id: string): Promise<JobRecord | null> {
    return this.kv.get<JobRecord>(this.keyById(id));
  }

  async transition(
    id: string,
    patch: Partial<Omit<JobRecord, 'id' | 'createdAt'>>,
  ): Promise<JobRecord | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: JobRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.kv.put(this.keyById(id), updated);
    return updated;
  }

  async *list(): AsyncIterable<JobRecord> {
    for await (const { value } of this.kv.list<JobRecord>(HYPERDB_PREFIX.job)) {
      yield value;
    }
  }
}
