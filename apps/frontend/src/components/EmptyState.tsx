import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description !== undefined && (
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{description}</p>
      )}
      {action !== undefined && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
