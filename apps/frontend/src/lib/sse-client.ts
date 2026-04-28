// SSE client for streaming chat completions.
//
// We use `fetch` + `ReadableStream` instead of `EventSource` because:
//   - EventSource cannot set the `Authorization` header.
//   - EventSource cannot POST.
//   - EventSource has limited cancellation semantics; we want
//     `AbortController` integration so the Stop button cleanly closes the
//     worker generator (see `docs/architecture.md` §3 client-disconnect row).
//
// The parser yields each `data: {...}` payload as a typed
// `ChatCompletionChunk` until it encounters the terminating `[DONE]` marker
// or the response stream closes. Mid-stream errors (the backend emits them
// as `data: { error: ApiErrorBody }\n\n`) are surfaced as a thrown
// `ApiError`.

import type { ChatCompletionChunk, ChatCompletionRequest, ApiErrorBody } from '@cosmic/shared';

import { ApiError, networkError } from './api-error.js';
import { config } from './config.js';

const SSE_DONE_MARKER = '[DONE]';

/**
 * The streaming variant accepts the same body as the non-streaming
 * `ChatCompletionRequest`; we re-export it under a distinct name to make
 * call sites self-documenting.
 */
export type StreamChatCompletionInput = ChatCompletionRequest;

/**
 * Async iterator yielding `ChatCompletionChunk` events. Caller owns the
 * `AbortController` (typically wired to a Stop button).
 *
 * Throws `ApiError` on:
 *   - non-2xx initial response (auth / rate-limit / no workers / etc.).
 *   - mid-stream error frame.
 *   - network / parse failures (synthesized into `ApiError` shape).
 */
export async function* streamChatCompletion(
  apiKey: string,
  body: StreamChatCompletionInput,
  signal?: AbortSignal,
): AsyncGenerator<ChatCompletionChunk, void, void> {
  const url = `${config.backendUrl}/v1/chat/completions`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ ...body, stream: true }),
      signal,
    });
  } catch (err) {
    throw networkError(err);
  }

  if (!response.ok) {
    // Backend sent a JSON ApiErrorBody before opening the stream.
    let parsed: ApiErrorBody | null = null;
    try {
      parsed = (await response.json()) as ApiErrorBody;
    } catch {
      // fallthrough
    }
    if (parsed && typeof parsed === 'object' && 'code' in parsed) {
      throw new ApiError(parsed);
    }
    throw networkError(new Error(`HTTP ${response.status}`), response.status);
  }

  if (!response.body) {
    throw networkError(new Error('response body missing'), response.status);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;

      // SSE events are terminated by a blank line (`\n\n`).
      let eventEnd: number;
      while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
        const eventBlock = buffer.slice(0, eventEnd);
        buffer = buffer.slice(eventEnd + 2);

        const dataLine = eventBlock.split('\n').find((line) => line.startsWith('data:'));
        if (!dataLine) continue;

        const payload = dataLine.slice('data:'.length).trim();
        if (payload === SSE_DONE_MARKER) return;
        if (payload.length === 0) continue;

        let frame: unknown;
        try {
          frame = JSON.parse(payload);
        } catch {
          throw networkError(new Error('invalid SSE frame'), 0);
        }

        // Backend's mid-stream error envelope: `{ error: ApiErrorBody }`.
        if (frame && typeof frame === 'object' && 'error' in frame) {
          const errorBody = (frame as { error: unknown }).error as ApiErrorBody;
          throw new ApiError(errorBody);
        }

        yield frame as ChatCompletionChunk;
      }
    }
  } finally {
    // Best-effort cleanup. The reader may already be closed by abort.
    try {
      reader.releaseLock();
    } catch {
      // already released
    }
  }
}
