// Top-level layout: header with nav + main content area. Each route renders
// inside <main>. Keeps a single source of truth for the overall page chrome.

import { NavLink, Outlet } from 'react-router-dom';

const navItems: Array<{ to: string; label: string }> = [
  { to: '/keys', label: 'API keys' },
  { to: '/playground', label: 'Playground' },
  { to: '/dashboard', label: 'Dashboard' },
];

export default function AppShell(): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Cosmic <span className="text-slate-500">GPU Cloud</span>
          </h1>
          <nav className="flex gap-1" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
