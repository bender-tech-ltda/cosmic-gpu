// Top-level layout: header with nav + active-key indicator + main content
// area. Each route renders inside <main>. Keeps a single source of truth
// for the overall page chrome.

import { Link, NavLink, Outlet } from 'react-router-dom';

import { useActiveApiKey } from '../hooks/useActiveApiKey.js';
import { truncate } from '../lib/format.js';

const navItems: Array<{ to: string; label: string }> = [
  { to: '/keys', label: 'API keys' },
  { to: '/playground', label: 'Playground' },
  { to: '/dashboard', label: 'Dashboard' },
];

export default function AppShell(): JSX.Element {
  const apiKey = useActiveApiKey();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Cosmic <span className="text-slate-500">GPU Cloud</span>
          </h1>
          <div className="flex items-center gap-2">
            {apiKey !== null && <ActiveKeyPill plaintext={apiKey} />}
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
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function ActiveKeyPill({ plaintext }: { plaintext: string }): JSX.Element {
  // Show only the prefix; never the full plaintext (matches the audit /
  // logging convention used elsewhere).
  const prefix = truncate(plaintext, 10);
  return (
    <Link
      to="/keys"
      data-testid="active-key-pill"
      title="Active API key (click to manage)"
      aria-label={`Active API key prefix ${prefix}`}
      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-mono text-xs text-emerald-900 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100"
    >
      <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
      key: {prefix}
    </Link>
  );
}
