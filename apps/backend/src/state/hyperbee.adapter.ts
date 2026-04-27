// Production KvStore: Hyperbee on Hypercore on disk.
// Single-writer, append-only log under the hood. Suitable for the demo
// and the natural fit with the rest of the Holepunch stack.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import Hyperbee from 'hyperbee';
import Hypercore from 'hypercore';

import type { KvEntry, KvStore } from './types.js';

export interface HyperbeeAdapterOptions {
  /** Directory where the underlying Hypercore data files live. */
  dataDir: string;
}

export class HyperbeeKvStore implements KvStore {
  private readonly storagePath: string;
  private core: Hypercore | null = null;
  private bee: Hyperbee | null = null;

  constructor(opts: HyperbeeAdapterOptions) {
    this.storagePath = path.join(opts.dataDir, 'state');
  }

  async ready(): Promise<void> {
    if (this.bee) return;
    await mkdir(this.storagePath, { recursive: true });
    this.core = new Hypercore(this.storagePath);
    this.bee = new Hyperbee(this.core, {
      keyEncoding: 'utf8',
      valueEncoding: 'json',
    });
    await this.bee.ready();
  }

  async close(): Promise<void> {
    if (this.bee) {
      await this.bee.close();
      this.bee = null;
    }
    if (this.core) {
      await this.core.close();
      this.core = null;
    }
  }

  private bee_(): Hyperbee {
    if (!this.bee) throw new Error('HyperbeeKvStore: ready() not called');
    return this.bee;
  }

  async get<T>(key: string): Promise<T | null> {
    const node = await this.bee_().get(key);
    if (!node) return null;
    return node.value as T;
  }

  async put<T>(key: string, value: T): Promise<void> {
    await this.bee_().put(key, value);
  }

  async del(key: string): Promise<void> {
    await this.bee_().del(key);
  }

  async *list<T>(prefix: string): AsyncIterable<KvEntry<T>> {
    // `\uFFFF` is the largest BMP code point — keys starting with `prefix`
    // followed by anything will sort before `prefix + \uFFFF`.
    const stream = this.bee_().createReadStream({ gte: prefix, lt: `${prefix}\uFFFF` });
    for await (const entry of stream) {
      const key = typeof entry.key === 'string' ? entry.key : entry.key.toString('utf8');
      yield { key, value: entry.value as T };
    }
  }
}
