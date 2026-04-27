// Minimal ambient declarations for the Holepunch packages we consume.
// None of these ship official TypeScript types, so we declare only the
// surfaces the backend actually touches (mirrors `apps/worker/src/types/hyperdht.d.ts`).

declare module 'hyperdht' {
  /** ed25519 keypair compatible with Noise / Hyperswarm. */
  export interface HyperDhtKeyPair {
    /** 32-byte ed25519 public key. */
    publicKey: Buffer;
    /** 64-byte libsodium-format ed25519 secret key (seed + public key). */
    secretKey: Buffer;
  }

  export default class HyperDHT {
    /**
     * Deterministically derive a keypair from a 32-byte seed. With no seed,
     * a random keypair is generated.
     */
    static keyPair(seed?: Buffer | Uint8Array): HyperDhtKeyPair;
  }
}

declare module 'hyperswarm' {
  import type { EventEmitter } from 'node:events';
  import type { HyperDhtKeyPair } from 'hyperdht';

  export interface HyperswarmJoinOptions {
    server?: boolean;
    client?: boolean;
  }

  export interface HyperswarmConnection extends NodeJS.ReadWriteStream {
    remotePublicKey: Buffer;
    publicKey: Buffer;
    on(event: 'close', cb: () => void): this;
    on(event: 'error', cb: (err: Error) => void): this;
    destroy(err?: Error): void;
  }

  export interface HyperswarmOptions {
    keyPair?: HyperDhtKeyPair;
    seed?: Buffer | Uint8Array;
    bootstrap?: Array<{ host: string; port: number }> | string[];
    dht?: unknown;
    maxPeers?: number;
  }

  export interface HyperswarmDiscovery {
    destroy(): Promise<void> | void;
    flushed(): Promise<void>;
  }

  export default class Hyperswarm extends EventEmitter {
    constructor(options?: HyperswarmOptions);
    readonly dht: unknown;
    readonly keyPair: HyperDhtKeyPair;
    readonly destroyed: boolean;
    join(topic: Buffer | Uint8Array, options?: HyperswarmJoinOptions): HyperswarmDiscovery;
    leave(topic: Buffer | Uint8Array): Promise<void>;
    flush(): Promise<void>;
    destroy(): Promise<void>;
    on(event: 'connection', cb: (conn: HyperswarmConnection, info: unknown) => void): this;
    on(event: 'update' | 'listening' | 'close' | 'error', cb: (...args: unknown[]) => void): this;
  }
}

declare module '@hyperswarm/rpc' {
  import type { HyperDhtKeyPair } from 'hyperdht';

  export interface RpcEncoding<T = unknown> {
    preencode(state: { start: number; end: number; buffer: Uint8Array | null }, value: T): void;
    encode(state: { start: number; end: number; buffer: Uint8Array | null }, value: T): void;
    decode(state: { start: number; end: number; buffer: Uint8Array | null }): T;
  }

  export interface RpcRequestOptions<TReq = unknown, TRes = unknown> {
    valueEncoding?: RpcEncoding;
    requestEncoding?: RpcEncoding<TReq>;
    responseEncoding?: RpcEncoding<TRes>;
  }

  export interface RpcOptions {
    keyPair?: HyperDhtKeyPair;
    seed?: Buffer | Uint8Array;
    bootstrap?: Array<{ host: string; port: number }> | string[];
    dht?: unknown;
  }

  export default class HyperswarmRPC {
    constructor(options?: RpcOptions);
    readonly dht: unknown;
    request<TRes = unknown>(
      publicKey: Buffer,
      method: string,
      value: unknown,
      options?: RpcRequestOptions<unknown, TRes>,
    ): Promise<TRes>;
    destroy(options?: { force?: boolean }): Promise<void>;
  }
}
