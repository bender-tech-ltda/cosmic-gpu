// Thin wrapper over `@hyperswarm/rpc` so the dispatcher can depend on a small
// interface and tests can substitute an in-process stub. The wrapper exists
// purely for testability; in production it's a one-line passthrough.

import HyperswarmRPC, { type RpcEncoding } from '@hyperswarm/rpc';

import type { NodeIdentity } from '../state/identity.js';

export interface RpcCodecs<TReq, TRes> {
  requestEncoding: RpcEncoding<TReq>;
  responseEncoding: RpcEncoding<TRes>;
}

export interface RpcClient {
  request<TReq, TRes>(
    workerPubKey: Buffer,
    method: string,
    value: TReq,
    codecs: RpcCodecs<TReq, TRes>,
  ): Promise<TRes>;
  close(): Promise<void>;
}

export interface RpcClientDeps {
  identity: NodeIdentity;
  /** Reuse the swarm's DHT so we don't open a second one. */
  dht: unknown;
}

export function createRpcClient(deps: RpcClientDeps): RpcClient {
  const rpc = new HyperswarmRPC({
    keyPair: { publicKey: deps.identity.publicKey, secretKey: deps.identity.secretKey },
    dht: deps.dht,
  });

  return {
    async request<TReq, TRes>(
      workerPubKey: Buffer,
      method: string,
      value: TReq,
      codecs: RpcCodecs<TReq, TRes>,
    ): Promise<TRes> {
      return rpc.request<TRes>(workerPubKey, method, value, {
        requestEncoding: codecs.requestEncoding,
        responseEncoding: codecs.responseEncoding,
      });
    },
    async close(): Promise<void> {
      await rpc.destroy();
    },
  };
}
