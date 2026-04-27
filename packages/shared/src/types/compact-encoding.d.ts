// Loose ambient TypeScript types for the `compact-encoding` package, which
// ships only runtime JS. We intentionally keep the surface narrow — only the
// codecs and helpers we actually use.

declare module 'compact-encoding' {
  export interface State {
    start: number;
    end: number;
    buffer: Uint8Array | null;
  }

  export interface AnyCodec<T = unknown> {
    preencode(state: State, value: T): void;
    encode(state: State, value: T): void;
    decode(state: State): T;
  }

  interface CompactEncoding {
    bool: AnyCodec<boolean>;
    uint: AnyCodec<number>;
    int: AnyCodec<number>;
    string: AnyCodec<string>;
    fixed32: AnyCodec<Uint8Array>;
    fixed64: AnyCodec<Uint8Array>;
    raw: AnyCodec<Uint8Array>;
    array<T>(item: AnyCodec<T>): AnyCodec<T[]>;
    encode<T>(codec: AnyCodec<T>, value: T): Uint8Array;
    decode<T>(codec: AnyCodec<T>, buffer: Uint8Array): T;
  }

  const c: CompactEncoding;
  export default c;
}
