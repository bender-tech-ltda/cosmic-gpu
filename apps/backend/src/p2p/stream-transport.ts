// Streaming inference transport.
//
// Worker streaming travels over a Protomux channel on top of the encrypted
// Hyperswarm secret stream (per `docs/architecture.md` §2.3). The backend's
// dispatcher consumes this small interface so it can be unit-tested with an
// in-process stub; the production implementation
// (`createProtomuxStreamTransport`) attaches Protomux to the existing
// swarm connection the worker established when it joined the topic.
//
// We REUSE the swarm connection rather than opening a fresh
// `dht.connect(workerPubKey)`. The worker's stream-channel handler
// (`apps/worker/src/runtime/stream-channel.ts`) is wired to
// `swarm.on('connection')` and therefore registers the
// `cosmic/inference-stream/v1` Protomux protocol only on swarm
// connections. A fresh dht.connect lands on the worker's separate
// `@hyperswarm/rpc` server DHT listener, where the streaming protocol
// is never registered — the channel never opens and the request times
// out (this is the SSE-timeout symptom reviewers observed under
// Compose).

import {
  inferenceRequestCodec,
  inferenceResponseCodec,
  type InferenceRequest,
  type InferenceResponse,
} from '@cosmic/shared';
import type { HyperswarmConnection } from 'hyperswarm';
import Protomux from 'protomux';

export const INFERENCE_STREAM_PROTOCOL = 'cosmic/inference-stream/v1';

export interface StreamTransport {
  /**
   * Open a streaming inference channel against `workerPubKey`. Yields each
   * worker frame in arrival order; consumers should stop iterating once they
   * see a `kind: 'final'` frame. `signal.abort()` closes the underlying
   * channel.
   */
  openStream(
    workerPubKey: Buffer,
    request: InferenceRequest,
    signal?: AbortSignal,
  ): AsyncIterable<InferenceResponse>;
  close(): Promise<void>;
}

export interface ProtomuxStreamTransportDeps {
  /**
   * Resolver for the live swarm connection to a worker. Returns null when
   * the worker is unknown to the registry (never connected or already
   * soft-removed). The dispatcher refuses to dispatch in that case.
   */
  getConn(workerPubKey: Buffer): HyperswarmConnection | null;
}

export function createProtomuxStreamTransport(deps: ProtomuxStreamTransportDeps): StreamTransport {
  return {
    openStream(workerPubKey, request, signal) {
      return openOne(deps.getConn, workerPubKey, request, signal);
    },
    async close() {
      // The transport doesn't own any connections — registry owns them.
    },
  };
}

async function* openOne(
  getConn: (pubKey: Buffer) => HyperswarmConnection | null,
  workerPubKey: Buffer,
  request: InferenceRequest,
  signal?: AbortSignal,
): AsyncIterable<InferenceResponse> {
  const stream = getConn(workerPubKey) as
    | (HyperswarmConnection & {
        on(event: 'error' | 'close', cb: (err?: Error) => void): unknown;
      })
    | null;
  if (stream === null) {
    throw new Error('no live swarm connection for worker');
  }

  // Long-lived `'error'` handler so a mid-stream failure (peer reset,
  // timeout) doesn't terminate the process. The shared connection may
  // outlive this stream — multiple inference streams can be multiplexed
  // over the same Protomux mux — so we do NOT destroy the underlying
  // stream on error or completion, only close our channel.
  let streamFailed: Error | null = null;
  const onStreamError = (err?: Error): void => {
    streamFailed = err ?? new Error('stream error');
  };
  stream.on('error', onStreamError);

  const mux = Protomux.from(stream);
  const channel = mux.createChannel({
    protocol: INFERENCE_STREAM_PROTOCOL,
  });
  if (channel === null) {
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
    stream.removeListener?.('error', onStreamError);
    try {
      channel.close();
    } catch {
      /* swallow */
    }
    // Do NOT destroy the underlying swarm connection — it's owned by the
    // worker registry and may be carrying other channels (worker.health
    // RPC over its own mux, or other in-flight inference streams).
  }
}
