// Worker-side Protomux channel for streaming inference.
//
// Listens for incoming Hyperswarm connections, attaches `Protomux.from(stream)`
// to each, and registers the `cosmic/inference-stream/v1` channel. When a peer
// (typically the backend dispatcher) opens the channel, the listener decodes
// the `InferenceRequest`, drives the existing `streamInference` async
// generator, and sends each `InferenceResponse` frame back. Channel close
// (initiated by either side) propagates to the generator via an
// `AbortController` so cancellation flows worker-ward.
//
// The transport stays thin on purpose: the unit-tested `streamInference`
// handler owns the inference logic; this module is the wiring that lives or
// dies with the live Hyperswarm setup. Live integration is exercised in the
// Compose smoke run from Step 6.5.

import {
  inferenceRequestCodec,
  inferenceResponseCodec,
  type InferenceRequest,
  type InferenceResponse,
} from '@cosmic/shared';
import type { Logger } from 'pino';
import Protomux from 'protomux';
import type Hyperswarm from 'hyperswarm';
import type { HyperswarmConnection } from 'hyperswarm';

import type { InferenceHandlerDeps } from '../handlers/inference.handler.js';
import { streamInference } from '../handlers/inference-stream.handler.js';

export const INFERENCE_STREAM_PROTOCOL = 'cosmic/inference-stream/v1';

export interface StreamChannelServerDeps {
  swarm: Hyperswarm;
  log: Logger;
  inference: InferenceHandlerDeps;
}

export interface StreamChannelServer {
  start(): void;
  stop(): void;
}

export function attachStreamChannelServer(deps: StreamChannelServerDeps): StreamChannelServer {
  let listener: ((conn: HyperswarmConnection) => void) | null = null;

  return {
    start() {
      if (listener !== null) return;
      const onConnection = (conn: HyperswarmConnection): void => {
        try {
          attachToConnection(conn, deps);
        } catch (err) {
          deps.log.warn({ err }, 'stream-channel.attach failed');
        }
      };
      listener = onConnection;
      deps.swarm.on('connection', onConnection);
    },
    stop() {
      if (listener !== null) {
        // Hyperswarm's typed `on` doesn't expose `off`; the swarm shutdown
        // closes all connections anyway, so the listener becomes a no-op.
        listener = null;
      }
    },
  };
}

function attachToConnection(conn: HyperswarmConnection, deps: StreamChannelServerDeps): void {
  const mux = Protomux.from(conn);
  const channel = mux.createChannel({
    protocol: INFERENCE_STREAM_PROTOCOL,
  });
  if (channel === null) {
    deps.log.warn('inference-stream channel was rejected by mux');
    return;
  }

  let abort: AbortController | null = null;

  const responseMessage = channel.addMessage({
    encoding: inferenceResponseCodec,
  });

  channel.addMessage({
    encoding: inferenceRequestCodec,
    onmessage(req: InferenceRequest) {
      const ctrl = new AbortController();
      abort = ctrl;
      void runStream(req, deps, ctrl.signal, (frame: InferenceResponse) => {
        responseMessage.send(frame);
      })
        .catch((err: unknown) => {
          deps.log.warn({ err, jobId: req.jobId }, 'stream-channel.run failed');
        })
        .finally(() => {
          try {
            channel.close();
          } catch {
            /* swallow on shutdown */
          }
        });
    },
  });

  channel.open({
    onclose: () => {
      if (abort !== null) {
        abort.abort();
        abort = null;
      }
    },
  });
}

async function runStream(
  request: InferenceRequest,
  deps: StreamChannelServerDeps,
  signal: AbortSignal,
  send: (frame: InferenceResponse) => void,
): Promise<void> {
  for await (const frame of streamInference(request, deps.inference, signal)) {
    send(frame);
  }
}
