// Real `/playground` page.
//
// Sends a chat-completion request via SSE and renders tokens as they
// arrive. The Stop button aborts the AbortController which closes the
// Protomux substream on the worker side, ending the generator with
// `finishReason: 'cancelled'` (per `docs/architecture.md` §2.6.2).
//
// UX requirements (per `frontend-standards.mdc`):
//   - Loading state: "Streaming…" indicator + disabled Send button.
//   - Empty state: "Set an API key first" prompt linking to /keys.
//   - Error state: <ErrorBanner /> with the typed `code` label.
//   - Disabled buttons during pending mutations.
//   - aria-live="polite" on the response region for screen-reader updates.

import { Link } from 'react-router-dom';
import { useState, type FormEvent } from 'react';

import Button from '../components/Button.js';
import Card from '../components/Card.js';
import EmptyState from '../components/EmptyState.js';
import ErrorBanner from '../components/ErrorBanner.js';
import { useActiveApiKey } from '../hooks/useActiveApiKey.js';
import { useModels } from '../hooks/useModels.js';
import { useStreamChatCompletion } from '../hooks/useStreamChatCompletion.js';
import { formatLatencyMs } from '../lib/format.js';

export default function PlaygroundPage(): JSX.Element {
  const apiKey = useActiveApiKey();
  const models = useModels();
  const stream = useStreamChatCompletion(apiKey);

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<string>('mock-llm');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!apiKey) return;
    if (prompt.trim().length === 0) return;
    setStartedAt(performance.now());
    setFinishedAt(null);
    void stream
      .start({
        model,
        messages: [{ role: 'user', content: prompt }],
      })
      .finally(() => setFinishedAt(performance.now()));
  };

  const onStop = (): void => {
    stream.stop();
  };

  const onClear = (): void => {
    stream.reset();
    setStartedAt(null);
    setFinishedAt(null);
  };

  if (!apiKey) {
    return (
      <section className="space-y-6">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Playground</h2>
          <p className="mt-1 text-sm text-slate-600">
            Send a prompt and stream tokens back via SSE. The Stop button cancels the worker
            generator.
          </p>
        </header>
        <EmptyState
          title="No active API key"
          description="Create or select an API key on the Keys page first."
          action={
            <Link
              to="/keys"
              className="inline-flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Go to API keys
            </Link>
          }
        />
      </section>
    );
  }

  const elapsedMs =
    startedAt !== null && finishedAt !== null
      ? finishedAt - startedAt
      : startedAt !== null && stream.isStreaming
        ? performance.now() - startedAt
        : null;

  const modelOptions = models.data?.data.map((m) => m.id) ?? ['mock-llm'];
  const canSend = !stream.isStreaming && prompt.trim().length > 0;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Playground</h2>
        <p className="mt-1 text-sm text-slate-600">
          Send a prompt to a worker and stream tokens back. Press Stop to cancel mid-stream — the
          worker observes the channel close and terminates with{' '}
          <code className="rounded bg-slate-100 px-1 text-xs">finishReason: cancelled</code>.
        </p>
      </header>

      <Card title="Prompt">
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">Model</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={stream.isStreaming}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            >
              {modelOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">Message</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask the model something…"
              rows={4}
              disabled={stream.isStreaming}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!canSend}>
              {stream.isStreaming ? 'Streaming…' : 'Send'}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={onStop}
              disabled={!stream.isStreaming}
              aria-label="Stop streaming"
            >
              Stop
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClear}
              disabled={stream.isStreaming || (stream.text.length === 0 && stream.error === null)}
            >
              Clear
            </Button>
            {elapsedMs !== null && (
              <span className="ml-auto text-xs text-slate-500">
                {stream.isStreaming ? 'Elapsed' : 'Took'} {formatLatencyMs(elapsedMs)}
              </span>
            )}
          </div>
        </form>
      </Card>

      <Card title="Response">
        <ErrorBanner error={stream.error} variant="inline" />
        <div
          aria-live="polite"
          aria-busy={stream.isStreaming}
          data-testid="playground-response"
          className="min-h-[6rem] whitespace-pre-wrap rounded bg-slate-50 p-3 font-mono text-sm text-slate-900"
        >
          {stream.text.length === 0 && !stream.isStreaming && (
            <span className="italic text-slate-400">No response yet. Send a prompt above.</span>
          )}
          {stream.text}
          {stream.isStreaming && (
            <span
              aria-hidden="true"
              className="ml-1 inline-block h-3 w-2 animate-pulse bg-slate-900"
            />
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {stream.chunks.length} chunk{stream.chunks.length === 1 ? '' : 's'} received.
        </p>
      </Card>
    </section>
  );
}
