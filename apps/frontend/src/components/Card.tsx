import type { ReactNode } from 'react';

export interface CardProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function Card({ title, actions, children, className }: CardProps): JSX.Element {
  return (
    <section className={['rounded border border-slate-200 bg-white', className ?? ''].join(' ')}>
      {(title !== undefined || actions !== undefined) && (
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          {title !== undefined && (
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
          )}
          {actions !== undefined && <div className="flex gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
