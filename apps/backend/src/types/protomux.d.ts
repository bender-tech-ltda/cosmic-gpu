// Minimal ambient declaration for `protomux` (mirror of the worker's).

declare module 'protomux' {
  export interface ProtomuxMessageEncoding<T = unknown> {
    preencode(state: { start: number; end: number; buffer: Uint8Array | null }, value: T): void;
    encode(state: { start: number; end: number; buffer: Uint8Array | null }, value: T): void;
    decode(state: { start: number; end: number; buffer: Uint8Array | null }): T;
  }

  export interface ProtomuxMessageOptions<T = unknown> {
    encoding: ProtomuxMessageEncoding<T>;
    onmessage?: (msg: T) => void;
  }

  export interface ProtomuxMessage<T = unknown> {
    send(value: T): boolean;
  }

  export interface ProtomuxChannelOptions {
    protocol: string;
    id?: Buffer | Uint8Array | null;
    onopen?: (handshake: unknown) => void;
    onclose?: () => void;
    ondestroy?: () => void;
  }

  export interface ProtomuxChannel {
    addMessage<T = unknown>(opts: ProtomuxMessageOptions<T>): ProtomuxMessage<T>;
    open(handshake?: unknown): void;
    close(): void;
    destroy(): void;
  }

  export default class Protomux {
    static from(stream: NodeJS.ReadWriteStream): Protomux;
    createChannel(opts: ProtomuxChannelOptions): ProtomuxChannel | null;
    pair(opts: { protocol: string; id?: Buffer | null }, notify: () => void): void;
    unpair(opts: { protocol: string; id?: Buffer | null }): void;
  }
}
