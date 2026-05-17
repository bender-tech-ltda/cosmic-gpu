// Shared `P2P_BOOTSTRAP` parser.
//
// Both the worker's `Hyperswarm` instance and the worker's
// `@hyperswarm/rpc` server (which builds its own HyperDHT to avoid
// `KEYPAIR_ALREADY_USED` against the swarm listener) need to bootstrap
// from the same routing topology. If only the swarm receives the
// in-Compose bootstrap, the RPC DHT silently falls back to the public
// Holepunch mainnet — backend peers connect to the swarm listener but
// `dht.connect(workerPubKey)` resolves nothing, surfacing as
// `RPCError: CHANNEL_CLOSED/DESTROYED` and a soft-removal loop in the
// backend's WorkerRegistry.

export interface BootstrapNode {
  host: string;
  port: number;
}

export function parseBootstrap(value: string): BootstrapNode[] | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, portRaw] = entry.split(':');
      const port = Number.parseInt(portRaw ?? '', 10);
      if (!host || !Number.isFinite(port) || port <= 0) {
        throw new Error(`P2P_BOOTSTRAP entry is not host:port — got "${entry}"`);
      }
      return { host, port };
    });
}
