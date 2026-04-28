// Subscribes to the session-bound bearer-key store and returns the active
// key (or null when none is set). Re-renders whenever `setActiveApiKey` is
// called from anywhere in the app.

import { useSyncExternalStore } from 'react';

import { getActiveApiKey, subscribeApiKey } from '../lib/api-key-store.js';

export function useActiveApiKey(): string | null {
  return useSyncExternalStore(
    (cb) => subscribeApiKey(cb),
    () => getActiveApiKey(),
    () => null,
  );
}
