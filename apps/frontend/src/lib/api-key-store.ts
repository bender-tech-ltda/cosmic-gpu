// Session-only bearer key store.
//
// Persists the active plaintext API key in `sessionStorage` so a tab refresh
// keeps you authenticated, but closing the tab clears it. Per
// `frontend-standards.mdc`: long-term `localStorage` of bearer tokens is
// forbidden without explicit consent UI.
//
// The store doubles as a tiny pub/sub so the AppShell + page hooks can
// subscribe and re-render when the active key changes.

import { config } from './config.js';

const STORAGE_KEY = 'cosmic.apiKey';

type Listener = (key: string | null) => void;

const listeners = new Set<Listener>();

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return config.apiKeyStorage === 'localStorage' ? window.localStorage : window.sessionStorage;
}

export function getActiveApiKey(): string | null {
  const s = storage();
  if (!s) return null;
  const value = s.getItem(STORAGE_KEY);
  return value && value.length > 0 ? value : null;
}

export function setActiveApiKey(key: string | null): void {
  const s = storage();
  if (!s) return;
  if (key === null || key.length === 0) {
    s.removeItem(STORAGE_KEY);
  } else {
    s.setItem(STORAGE_KEY, key);
  }
  for (const listener of listeners) listener(key);
}

export function subscribeApiKey(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
