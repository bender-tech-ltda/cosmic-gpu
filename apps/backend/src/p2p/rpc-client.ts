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
  /**
   * Optional pre-existing HyperDHT instance (typically `swarm.dht`). When
   * provided, the RPC client reuses it for outbound `dht.connect()` lookups
   * instead of bootstrapping a brand-new DHT routing table from scratch.
   *
   * This is the recommended setup for the backend: the swarm's DHT has
   * already discovered worker pubkeys via `swarm.join(topic)`, so reusing
   * it lets the RPC client's `dht.connect(workerPubKey)` resolve
   * immediately. With a separate DHT, the cold routing table can
   * occasionally fail the lookup before the per-request stream times out,
   * surfacing as `RPCError: CHANNEL_DESTROYED`.
   *
   * Sharing is safe here because the RPC client never calls
   * `rpc.createServer().listen(keyPair)` — only outbound `dht.connect`,
   * which does NOT register a keypair on the DHT. The KEYPAIR_ALREADY_USED
   * constraint applies to listeners, not to client-side connects.
   *
   * Typed as `unknown` because the ambient `hyperdht` declaration only
   * exposes the static `keyPair` helper.
   */
  dht?: unknown;
}

export function createRpcClient(deps: RpcClientDeps): RpcClient {
  // When `dht` is provided we reuse it (see `RpcClientDeps.dht` JSDoc).
  // Otherwise `@hyperswarm/rpc` defaults to spinning up its own DHT.
  const rpc = new HyperswarmRPC({
    keyPair: { publicKey: deps.identity.publicKey, secretKey: deps.identity.secretKey },
    ...(deps.dht !== undefined ? { dht: deps.dht } : {}),
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
      // When `dht` was injected from the swarm we must NOT destroy it here;
      // the swarm owns its lifecycle and `swarmHandle.close()` will tear it
      // down at shutdown. `@hyperswarm/rpc` already short-circuits its
      // internal `_autoDestroy` when an external `dht` is supplied.
      await rpc.destroy();
    },
  };
}
