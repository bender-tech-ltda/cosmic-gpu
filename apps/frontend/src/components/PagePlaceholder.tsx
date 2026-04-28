// Shared placeholder banner used by the page-level routes during Step 9.
// Replaced with real implementations in Step 10.

export interface PagePlaceholderProps {
  title: string;
  description: string;
}

export default function PagePlaceholder({ title, description }: PagePlaceholderProps): JSX.Element {
  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-2 max-w-2xl text-slate-600">{description}</p>
      <div className="mt-6 rounded border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm font-medium text-slate-700">Page implementation lands in Step 10.</p>
        <p className="mt-1 text-xs text-slate-500">
          The data layer (typed API client + TanStack Query hooks) is already wired up.
        </p>
      </div>
    </section>
  );
}
