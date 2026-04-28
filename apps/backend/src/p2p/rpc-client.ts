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
}

export function createRpcClient(deps: RpcClientDeps): RpcClient {
  // Per `@hyperswarm/rpc` docs, `dht` "defaults to a new instance." We let
  // RPC build its own DHT rather than sharing the swarm's: shared-DHT mode
  // requires us to keep keypairs distinct between subsystems, which the
  // backend's single identity-keypair design doesn't satisfy.
  const rpc = new HyperswarmRPC({
    keyPair: { publicKey: deps.identity.publicKey, secretKey: deps.identity.secretKey },
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
