// Worker registry.
//
// Listens for `swarm.on('connection')` to learn worker pubkeys, polls each
// worker's `worker.health` on connection and at a fixed cadence, and writes
// `WorkerRecord`s into `app.state.workers`. Soft-removes a worker after N
// consecutive failed polls so the dispatcher's selection set tracks reality.
//
// The registry is decoupled from the dispatcher: the dispatcher reads workers
// straight from state, which makes its tests trivial (just upsert records).

import { RPC_METHOD, workerHealthCodec, type WorkerHealth } from '@cosmic/shared';
import type { FastifyBaseLogger } from 'fastify';
import type Hyperswarm from 'hyperswarm';
import type { HyperswarmConnection } from 'hyperswarm';

import type { WorkersState } from '../state/workers.state.js';
import type { RpcClient } from './rpc-client.js';

const HEALTH_REQUEST_CODEC = {
  preencode(): void {},
  encode(): void {},
  decode(): undefined {
    return undefined;
  },
};

export interface WorkerRegistryDeps {
  swarm: Hyperswarm;
  rpcClient: RpcClient;
  workersState: WorkersState;
  log: FastifyBaseLogger;
  /** Cadence between proactive `worker.health` polls. */
  pollIntervalMs: number;
  /** Soft-remove a worker after this many consecutive failed polls. */
  failureThreshold?: number;
  /** Injectable timer for tests; defaults to `setInterval`/`clearInterval`. */
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
}

interface PeerEntry {
  pubKey: Buffer;
  /** Hex form, the canonical worker id used everywhere downstream. */
  pubKeyHex: string;
  failures: number;
}

export class WorkerRegistry {
  private readonly peers = new Map<string, PeerEntry>();
  private readonly failureThreshold: number;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private timer: ReturnType<typeof setInterval> | null = null;
  private connectionListener: ((conn: HyperswarmConnection) => void) | null = null;

  constructor(private readonly deps: WorkerRegistryDeps) {
    this.failureThreshold = deps.failureThreshold ?? 3;
    this.setIntervalFn = deps.setInterval ?? setInterval;
    this.clearIntervalFn = deps.clearInterval ?? clearInterval;
  }

  start(): void {
    if (this.connectionListener !== null) return;
    const listener = (conn: HyperswarmConnection): void => {
      void this.onConnection(conn);
    };
    this.connectionListener = listener;
    this.deps.swarm.on('connection', listener);
    this.timer = this.setIntervalFn(() => {
      void this.pollAll();
    }, this.deps.pollIntervalMs);
    // Don't keep the event loop alive just for the heartbeat poller.
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer !== null) {
      this.clearIntervalFn(this.timer);
      this.timer = null;
    }
    this.connectionListener = null;
  }

  size(): number {
    return this.peers.size;
  }

  /**
   * Test seam. Lets a test simulate a peer connection without a live swarm.
   * Polls health once for the registered pubkey.
   */
  async registerPeer(pubKey: Buffer): Promise<void> {
    return this.onConnection({ remotePublicKey: pubKey } as unknown as HyperswarmConnection);
  }

  private async onConnection(conn: HyperswarmConnection): Promise<void> {
    const pubKey = conn.remotePublicKey;
    const pubKeyHex = pubKey.toString('hex');
    if (!this.peers.has(pubKeyHex)) {
      this.peers.set(pubKeyHex, { pubKey, pubKeyHex, failures: 0 });
      // Surface peer-discovery progress so we can confirm — from logs alone
      // — that the swarm has actually peered with N workers, independent of
      // whether `worker.health` succeeded yet.
      this.deps.log.info(
        { peers: this.peers.size, pubKey: pubKeyHex.slice(0, 8) + '…' },
        'p2p.peer_added',
      );
    }
    await this.pollOne(pubKeyHex);
  }

  private async pollAll(): Promise<void> {
    await Promise.all([...this.peers.keys()].map((hex) => this.pollOne(hex)));
  }

  private async pollOne(pubKeyHex: string): Promise<void> {
    const entry = this.peers.get(pubKeyHex);
    if (!entry) return;
    try {
      const snapshot = await this.deps.rpcClient.request<undefined, WorkerHealth>(
        entry.pubKey,
        RPC_METHOD.workerHealth,
        undefined,
        {
          requestEncoding: HEALTH_REQUEST_CODEC,
          responseEncoding: workerHealthCodec,
        },
      );
      entry.failures = 0;
      await this.deps.workersState.upsert({
        id: snapshot.workerId,
        pubKey: snapshot.workerPubKey,
        lastSeen: new Date().toISOString(),
        capacity: snapshot.capacity,
        inFlight: snapshot.inFlight,
        modelId: snapshot.modelId,
      });
    } catch (err) {
      entry.failures += 1;
      this.deps.log.warn(
        { pubKey: pubKeyHex.slice(0, 8) + '…', failures: entry.failures, err },
        'worker.health poll failed',
      );
      if (entry.failures >= this.failureThreshold) {
        this.peers.delete(pubKeyHex);
        await this.deps.workersState.remove(pubKeyHex);
        this.deps.log.warn({ pubKey: pubKeyHex.slice(0, 8) + '…' }, 'worker.soft_removed');
      }
    }
  }
}
