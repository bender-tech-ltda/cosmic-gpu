// UI formatters. Pure functions, vitest-friendly.

const numberFmt = new Intl.NumberFormat('en-US');

export function formatInt(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return numberFmt.format(Math.round(value));
}

/** Format milliseconds as a short, humane string (e.g. "12 ms", "1.4 s"). */
export function formatLatencyMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** ISO timestamp → short relative or wall-clock string. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

/** 0.95 → "95%". */
export function formatPercent(ratio: number, digits = 0): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Truncate a string with an ellipsis. Useful for long pubkeys / ids. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}
