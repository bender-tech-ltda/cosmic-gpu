// Minimal ambient declarations for the Holepunch packages we consume.
// None of these ship official TypeScript types, so we declare only the
// surfaces this app actually touches.

declare module 'hyperdht' {
  export interface HyperDhtKeyPair {
    publicKey: Buffer;
    secretKey: Buffer;
  }

  export default class HyperDHT {
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

  export interface RpcRespondOptions<TReq = unknown, TRes = unknown> {
    valueEncoding?: RpcEncoding;
    requestEncoding?: RpcEncoding<TReq>;
    responseEncoding?: RpcEncoding<TRes>;
  }

  export type RpcHandler<TReq = unknown, TRes = unknown> = (request: TReq) => TRes | Promise<TRes>;

  export interface RpcServer {
    publicKey: Buffer;
    listen(keyPair?: HyperDhtKeyPair): Promise<void>;
    close(): Promise<void>;
    respond<TReq = unknown, TRes = unknown>(
      method: string,
      options: RpcRespondOptions<TReq, TRes>,
      handler: RpcHandler<TReq, TRes>,
    ): void;
    unrespond(method: string): void;
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
    createServer(options?: { firewall?: (publicKey: Buffer) => boolean }): RpcServer;
    request<TRes = unknown>(
      publicKey: Buffer,
      method: string,
      value: unknown,
      options?: { requestEncoding?: RpcEncoding; responseEncoding?: RpcEncoding<TRes> },
    ): Promise<TRes>;
    destroy(options?: { force?: boolean }): Promise<void>;
  }
}
