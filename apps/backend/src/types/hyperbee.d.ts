// Minimal ambient declarations for the `hyperbee` runtime library.
// Only the surface used by `hyperbee.adapter.ts` is typed.

declare module 'hyperbee' {
  import type Hypercore from 'hypercore';

  export interface HyperbeeOptions {
    keyEncoding?: 'utf8' | 'binary' | 'json' | 'utf-8' | 'ascii';
    valueEncoding?: 'utf8' | 'binary' | 'json' | 'utf-8' | 'ascii';
  }

  export interface HyperbeeNode {
    seq: number;
    key: string | Buffer;
    value: unknown;
  }

  export interface ReadStreamOptions {
    gte?: string;
    gt?: string;
    lte?: string;
    lt?: string;
    reverse?: boolean;
    limit?: number;
  }

  class Hyperbee {
    constructor(core: Hypercore, options?: HyperbeeOptions);
    ready(): Promise<void>;
    close(): Promise<void>;
    get(key: string): Promise<HyperbeeNode | null>;
    put(key: string, value: unknown): Promise<void>;
    del(key: string): Promise<void>;
    createReadStream(options?: ReadStreamOptions): AsyncIterable<HyperbeeNode>;
  }

  export default Hyperbee;
}
