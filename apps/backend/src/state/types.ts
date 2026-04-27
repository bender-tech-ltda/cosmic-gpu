// Single abstraction every state accessor depends on.
// Both adapters (in-memory, Hyperbee) implement this interface so accessors
// stay backend-agnostic.

export interface KvEntry<T> {
  key: string;
  value: T;
}

export interface KvStore {
  /** Open underlying resources (file handles, network, etc.). Idempotent. */
  ready(): Promise<void>;
  /** Release underlying resources. */
  close(): Promise<void>;
  /** Returns null when the key is absent. */
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  /** Async iterator over entries whose key starts with `prefix`. */
  list<T>(prefix: string): AsyncIterable<KvEntry<T>>;
}

export class StateError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'StateError';
  }
}
