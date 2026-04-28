import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
}

export default function StatCard({ label, value, hint }: StatCardProps): JSX.Element {
  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint !== undefined && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
