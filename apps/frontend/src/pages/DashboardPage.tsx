// Real `/dashboard` page.
//
// Composes:
//   - useHealth (5 s poll) for the swarm status banner.
//   - useMetrics (5 s poll) for the inference / token / latency / worker /
//     rate-limit stat cards.
//   - useUsageMe (5 s poll, gated on the active key) for the per-key
//     usage windows table.
//
// We deliberately do NOT render charts here — stat cards + a windowed
// table cover the FR-12 "metrics dashboard" requirement and stay
// reviewable inside the take-home time budget. Charts (sparklines) are
// listed under Future Improvements in `docs/architecture.md` §6.

import type { MetricsResponse, UsageSummary } from '@cosmic/shared';

import ErrorBanner from '../components/ErrorBanner.js';
import EmptyState from '../components/EmptyState.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import StatCard from '../components/StatCard.js';
import Card from '../components/Card.js';
import { useActiveApiKey } from '../hooks/useActiveApiKey.js';
import { useHealth } from '../hooks/useHealth.js';
import { useMetrics } from '../hooks/useMetrics.js';
import { useUsageMe } from '../hooks/useUsageMe.js';
import { formatInt, formatLatencyMs, formatTime, truncate } from '../lib/format.js';

export default function DashboardPage(): JSX.Element {
  const health = useHealth();
  const metrics = useMetrics();
  const usage = useUsageMe();
  const apiKey = useActiveApiKey();

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-600">
          Live counters and latency percentiles, polled every 5 s. Counters reset on backend restart
          — documented in{' '}
          <code className="rounded bg-slate-100 px-1 text-xs">docs/architecture.md §4.3</code>.
        </p>
      </header>

      {/* Health / swarm status banner. */}
      <SwarmStatus />

      {/* Metrics stat cards. */}
      <ErrorBanner error={metrics.error} variant="inline" />
      {metrics.isLoading && !metrics.data && <LoadingSpinner label="Loading metrics…" />}
      {metrics.data && <MetricsGrid data={metrics.data} />}

      {/* Per-key usage windows. */}
      <Card title="Your usage">
        {!apiKey && (
          <EmptyState
            title="Set an active API key"
            description="Create or pick a key on the Keys page to see per-key usage windows here."
          />
        )}
        {apiKey && usage.isLoading && <LoadingSpinner label="Loading usage…" />}
        <ErrorBanner error={usage.error} variant="inline" />
        {apiKey && usage.isSuccess && <UsageTable data={usage.data} />}
      </Card>
    </section>
  );

  function SwarmStatus(): JSX.Element {
    if (health.isLoading && !health.data) {
      return (
        <div className="rounded border border-slate-200 bg-white px-4 py-3">
          <LoadingSpinner label="Probing /health…" />
        </div>
      );
    }
    if (health.error) {
      return <ErrorBanner error={health.error} variant="inline" />;
    }
    if (!health.data) return <></>;
    const ok = health.data.status === 'ok' && health.data.p2p.connected;
    return (
      <div
        className={[
          'flex flex-wrap items-center gap-3 rounded border px-4 py-3 text-sm',
          ok
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-amber-200 bg-amber-50 text-amber-900',
        ].join(' ')}
      >
        <span className="font-semibold uppercase tracking-wide">{ok ? 'Healthy' : 'Degraded'}</span>
        <span>
          {health.data.p2p.peers} peer{health.data.p2p.peers === 1 ? '' : 's'} connected
        </span>
        <span className="ml-auto text-xs">v{health.data.version}</span>
      </div>
    );
  }
}

function MetricsGrid({ data }: { data: MetricsResponse }): JSX.Element {
  const { inference, workers, rateLimit } = data;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <StatCard
        label="Successful"
        value={formatInt(inference.requests.success)}
        hint={`${formatInt(inference.requests.failed)} failed · ${formatInt(
          inference.requests.cancelled,
        )} cancelled`}
      />
      <StatCard
        label="Tokens (prompt + completion)"
        value={formatInt(inference.tokens.prompt + inference.tokens.completion)}
        hint={`p${formatInt(inference.tokens.prompt)} + c${formatInt(inference.tokens.completion)}`}
      />
      <StatCard
        label="Latency p95"
        value={formatLatencyMs(inference.latencyMs.p95)}
        hint={`p50 ${formatLatencyMs(inference.latencyMs.p50)} · p99 ${formatLatencyMs(
          inference.latencyMs.p99,
        )} (n=${formatInt(inference.latencyMs.count)})`}
      />
      <StatCard
        label="Workers connected"
        value={formatInt(workers.connected)}
        hint={`capacity ${formatInt(workers.capacity)}`}
      />
      <StatCard
        label="Rate-limit rejections"
        value={formatInt(rateLimit.rejections)}
        hint="429 envelopes since start"
      />
      <StatCard
        label="Avg latency"
        value={formatLatencyMs(inference.latencyMs.avg)}
        hint="rolling window"
      />
    </div>
  );
}

function UsageTable({ data }: { data: UsageSummary }): JSX.Element {
  if (data.windows.length === 0) {
    return (
      <EmptyState
        title="No requests recorded for this key yet"
        description="Send a prompt from the Playground to populate the first usage window."
      />
    );
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Requests (this key)" value={formatInt(data.totals.requests)} />
        <StatCard label="Prompt tokens" value={formatInt(data.totals.promptTokens)} />
        <StatCard label="Completion tokens" value={formatInt(data.totals.completionTokens)} />
      </div>
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Window</th>
              <th className="px-3 py-2 text-right">Requests</th>
              <th className="px-3 py-2 text-right">Prompt</th>
              <th className="px-3 py-2 text-right">Completion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white tabular-nums">
            {data.windows.map((w) => (
              <tr key={w.windowStart}>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">
                  {truncate(formatTime(w.windowStart), 14)}
                </td>
                <td className="px-3 py-2 text-right">{formatInt(w.requests)}</td>
                <td className="px-3 py-2 text-right">{formatInt(w.promptTokens)}</td>
                <td className="px-3 py-2 text-right">{formatInt(w.completionTokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Showing the {data.windows.length} most recent window{data.windows.length === 1 ? '' : 's'}.
      </p>
    </div>
  );
}
