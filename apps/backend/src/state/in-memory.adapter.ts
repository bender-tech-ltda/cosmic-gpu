// Map-backed KvStore for tests and ephemeral dev use.
// Values are deep-cloned on the way in and out so mutations to returned
// objects don't leak back into storage.

import type { KvEntry, KvStore } from './types.js';

export class InMemoryKvStore implements KvStore {
  private readonly data = new Map<string, unknown>();

  async ready(): Promise<void> {
    // Nothing to open.
  }

  async close(): Promise<void> {
    this.data.clear();
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.data.get(key);
    if (value === undefined) return null;
    return structuredClone(value) as T;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.data.set(key, structuredClone(value));
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
  }

  async *list<T>(prefix: string): AsyncIterable<KvEntry<T>> {
    const keys = [...this.data.keys()].filter((k) => k.startsWith(prefix)).sort();
    for (const key of keys) {
      const value = this.data.get(key);
      if (value !== undefined) {
        yield { key, value: structuredClone(value) as T };
      }
    }
  }
}
