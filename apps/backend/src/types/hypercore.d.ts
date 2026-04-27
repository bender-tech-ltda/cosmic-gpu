// Minimal ambient declarations for the `hypercore` runtime library.
// Only the surface used by `hyperbee.adapter.ts` is typed.

declare module 'hypercore' {
  export interface HypercoreOptions {
    valueEncoding?: 'utf8' | 'binary' | 'json' | 'utf-8';
  }

  class Hypercore {
    constructor(storage: string | object, options?: HypercoreOptions);
    ready(): Promise<void>;
    close(): Promise<void>;
  }

  export default Hypercore;
}
