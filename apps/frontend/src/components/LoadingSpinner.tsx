export interface LoadingSpinnerProps {
  label?: string;
}

export default function LoadingSpinner({ label = 'Loading…' }: LoadingSpinnerProps): JSX.Element {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
      />
      <span>{label}</span>
    </div>
  );
}
