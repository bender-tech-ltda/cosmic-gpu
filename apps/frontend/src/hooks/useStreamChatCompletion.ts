// Hook wrapping `streamChatCompletion`. Exposes a stateful API
// that pages can drive with a Send + Stop button:
//
//   const { start, stop, text, chunks, isStreaming, error, reset } =
//     useStreamChatCompletion(apiKey);
//
// `start(input)` opens the SSE stream and accumulates chunks into `text`.
// `stop()` aborts the stream (worker generator observes the close and
// emits `finishReason: 'cancelled'`). `reset()` clears state for a new run.

import { useCallback, useRef, useState } from 'react';
import type { ChatCompletionChunk } from '@cosmic/shared';

import { isApiError, networkError, type ApiError } from '../lib/api-error.js';
import { streamChatCompletion, type StreamChatCompletionInput } from '../lib/sse-client.js';

export interface StreamChatCompletionState {
  start: (input: StreamChatCompletionInput) => Promise<void>;
  stop: () => void;
  reset: () => void;
  text: string;
  chunks: ChatCompletionChunk[];
  isStreaming: boolean;
  error: ApiError | null;
}

export function useStreamChatCompletion(apiKey: string | null): StreamChatCompletionState {
  const [text, setText] = useState('');
  const [chunks, setChunks] = useState<ChatCompletionChunk[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setText('');
    setChunks([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const start = useCallback(
    async (input: StreamChatCompletionInput) => {
      if (!apiKey) {
        setError(networkError(new Error('No API key. Create one on the API keys page first.')));
        return;
      }
      reset();
      setIsStreaming(true);
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        for await (const frame of streamChatCompletion(apiKey, input, controller.signal)) {
          setChunks((prev) => [...prev, frame]);
          const delta = frame.choices[0]?.delta.content;
          if (typeof delta === 'string' && delta.length > 0) {
            setText((prev) => prev + delta);
          }
        }
      } catch (err) {
        // AbortError is the user pressing Stop; not surfaced as an error.
        if (controller.signal.aborted) return;
        if (isApiError(err)) setError(err);
        else setError(networkError(err));
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
        setIsStreaming(false);
      }
    },
    [apiKey, reset],
  );

  return { start, stop, reset, text, chunks, isStreaming, error };
}
