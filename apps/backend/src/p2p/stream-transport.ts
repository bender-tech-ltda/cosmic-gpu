// Streaming inference transport.
//
// Worker streaming travels over a Protomux channel on top of the encrypted
// Hyperswarm secret stream (per `docs/architecture.md` §2.3). The backend's
// dispatcher consumes this small interface so it can be unit-tested with an
// in-process stub; the production implementation (`createProtomuxStreamTransport`)
// opens a fresh `dht.connect(workerPubKey)` per stream and attaches Protomux
// to it.
//
// We open a fresh connection per stream rather than reusing the
// `@hyperswarm/rpc` client's mux to keep the two transports cleanly
// separated. The trade-off — one extra Noise handshake per streamed
// completion — is documented in `docs/architecture.md`.
//
// The runtime impl is intentionally thin: it defers correctness of channel
// framing / handshake order to the unit-tested handler logic, and the live
// path is exercised end-to-end in the Compose smoke run from Step 6.5.

import {
  inferenceRequestCodec,
  inferenceResponseCodec,
  type InferenceRequest,
  type InferenceResponse,
} from '@cosmic/shared';
import Protomux from 'protomux';

import type { NodeIdentity } from '../state/identity.js';

export const INFERENCE_STREAM_PROTOCOL = 'cosmic/inference-stream/v1';

export interface StreamTransport {
  /**
   * Open a streaming inference channel against `workerPubKey`. Yields each
   * worker frame in arrival order; consumers should stop iterating once they
   * see a `kind: 'final'` frame. `signal.abort()` closes the underlying
   * channel + connection.
   */
  openStream(
    workerPubKey: Buffer,
    request: InferenceRequest,
    signal?: AbortSignal,
  ): AsyncIterable<InferenceResponse>;
  close(): Promise<void>;
}

export interface ProtomuxStreamTransportDeps {
  identity: NodeIdentity;
  /**
   * HyperDHT instance shared with the swarm. Typed as `unknown` here because
   * the ambient `hyperdht` declaration only describes the static `keyPair`
   * helper; this is the one place we need a runtime instance method.
   */
  dht: unknown;
}

interface DhtLike {
  connect(
    publicKey: Buffer,
    options?: { keyPair?: { publicKey: Buffer; secretKey: Buffer } },
  ): NodeJS.ReadWriteStream & {
    once(event: 'open' | 'error' | 'close', cb: (err?: Error) => void): unknown;
    on(event: 'error' | 'close', cb: (err?: Error) => void): unknown;
    destroy(err?: Error): void;
  };
}

export function createProtomuxStreamTransport(deps: ProtomuxStreamTransportDeps): StreamTransport {
  const dht = deps.dht as DhtLike;

  return {
    openStream(workerPubKey, request, signal) {
      return openOne(dht, deps.identity, workerPubKey, request, signal);
    },
    async close() {
      // Each stream owns its own connection and tears it down in `finally`,
      // so there's nothing extra to clean up at the transport level.
    },
  };
}

async function* openOne(
  dht: DhtLike,
  identity: NodeIdentity,
  workerPubKey: Buffer,
  request: InferenceRequest,
  signal?: AbortSignal,
): AsyncIterable<InferenceResponse> {
  const stream = dht.connect(workerPubKey, {
    keyPair: { publicKey: identity.publicKey, secretKey: identity.secretKey },
  });

  // Long-lived `'error'` handler so a mid-stream failure (peer reset,
  // timeout) doesn't terminate the process. The handshake-only `once`
  // listener below detaches itself; this one stays for the stream's life.
  // We mark the iterator as closed via the same wake mechanism used by
  // `onClose`, so the consumer sees an orderly end instead of a crash.
  let streamFailed: Error | null = null;
  stream.on('error', (err?: Error) => {
    streamFailed = err ?? new Error('stream error');
  });

  await new Promise<void>((resolve, reject) => {
    stream.once('open', () => resolve());
    stream.once('error', (err?: Error) => reject(err ?? new Error('connect failed')));
  });

  const mux = Protomux.from(stream);
  const channel = mux.createChannel({
    protocol: INFERENCE_STREAM_PROTOCOL,
  });
  if (channel === null) {
    stream.destroy();
    throw new Error('failed to open inference-stream channel');
  }

  const queue: InferenceResponse[] = [];
  let resume: (() => void) | null = null;
  let closed = false;

  const wake = (): void => {
    if (resume) {
      const r = resume;
      resume = null;
      r();
    }
  };

  channel.addMessage({
    encoding: inferenceResponseCodec,
    onmessage(msg: InferenceResponse) {
      queue.push(msg);
      wake();
    },
  });
  const requestMessage = channel.addMessage({
    encoding: inferenceRequestCodec,
  });

  const onClose = (): void => {
    closed = true;
    wake();
  };
  channel.open({ onclose: onClose });

  const onAbort = (): void => {
    try {
      channel.close();
    } catch {
      /* swallow */
    }
    stream.destroy();
  };
  signal?.addEventListener('abort', onAbort);

  try {
    requestMessage.send(request);

    while (!closed) {
      if (streamFailed !== null) throw streamFailed;
      if (queue.length > 0) {
        const next = queue.shift() as InferenceResponse;
        yield next;
        if (next.kind === 'final') return;
      } else {
        await new Promise<void>((resolve) => {
          resume = resolve;
        });
      }
    }
    if (streamFailed !== null) throw streamFailed;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    try {
      channel.close();
    } catch {
      /* swallow */
    }
    stream.destroy();
  }
}
