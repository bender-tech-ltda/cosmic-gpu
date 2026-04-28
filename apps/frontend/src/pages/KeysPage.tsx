// Real `/keys` page. Composes the existing TanStack Query hooks +
// shared UI primitives. UX requirements (per `frontend-standards.mdc`):
//   - Loading state via <LoadingSpinner />.
//   - Error state via <ErrorBanner />.
//   - Empty state via <EmptyState /> with a primary action.
//   - Disabled buttons during pending mutations.
//
// One-time plaintext display: when `useCreateApiKey` succeeds, the new
// `plaintext` is shown exactly once with a Copy button and a "save it
// now" warning. Setting it as the active key in `sessionStorage`
// happens automatically so the Playground works immediately.

import { useState, type FormEvent } from 'react';
import type { ApiKey, ApiKeyCreatedResponse } from '@cosmic/shared';

import Button from '../components/Button.js';
import Card from '../components/Card.js';
import EmptyState from '../components/EmptyState.js';
import ErrorBanner from '../components/ErrorBanner.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import { useActiveApiKey } from '../hooks/useActiveApiKey.js';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '../hooks/useApiKeys.js';
import { setActiveApiKey } from '../lib/api-key-store.js';
import { formatDate, formatTime, truncate } from '../lib/format.js';

export default function KeysPage(): JSX.Element {
  const list = useApiKeys();
  const createMutation = useCreateApiKey();
  const revokeMutation = useRevokeApiKey();
  const activeKey = useActiveApiKey();

  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedResponse | null>(null);

  const onCreate = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const name = newKeyName.trim();
    if (name.length === 0) return;
    try {
      const result = await createMutation.mutateAsync({ name });
      setCreatedKey(result);
      setActiveApiKey(result.plaintext);
      setNewKeyName('');
    } catch {
      /* ErrorBanner consumes */
    }
  };

  const onRevoke = async (id: string): Promise<void> => {
    if (!confirm(`Revoke key ${id}? Inference requests using it will fail with 403.`)) {
      return;
    }
    try {
      await revokeMutation.mutateAsync(id);
    } catch {
      /* ErrorBanner consumes */
    }
  };

  const dismissPlaintext = (): void => setCreatedKey(null);

  const onCopyPlaintext = async (): Promise<void> => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.plaintext);
    } catch {
      /* clipboard rejected; user can still select+copy from the field */
    }
  };

  const onClearActive = (): void => setActiveApiKey(null);

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">API keys</h2>
        <p className="mt-1 text-sm text-slate-600">
          Create, list, and revoke API keys. The plaintext value is shown{' '}
          <strong>exactly once</strong> on creation — store it securely.
        </p>
      </header>

      {createdKey && (
        <Card
          title="New API key — copy it now"
          actions={
            <Button variant="ghost" onClick={dismissPlaintext} aria-label="Dismiss">
              ×
            </Button>
          }
        >
          <p className="text-sm text-slate-700">
            This is the only time the plaintext is shown. After dismissing this banner, only the
            prefix remains visible.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code
              data-testid="created-key-plaintext"
              className="flex-1 break-all rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-900"
            >
              {createdKey.plaintext}
            </code>
            <Button variant="secondary" onClick={onCopyPlaintext}>
              Copy
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Active key set automatically. Use the Playground to issue your first request.
          </p>
        </Card>
      )}

      <Card title="Create a key">
        <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-700">Name</span>
            <input
              type="text"
              required
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g. cli-laptop"
              maxLength={64}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              disabled={createMutation.isPending}
            />
          </label>
          <Button
            type="submit"
            disabled={createMutation.isPending || newKeyName.trim().length === 0}
          >
            {createMutation.isPending ? 'Creating…' : 'Create key'}
          </Button>
        </form>
        <ErrorBanner error={createMutation.error} variant="inline" />
      </Card>

      <Card
        title="Existing keys"
        actions={
          activeKey ? (
            <Button variant="ghost" onClick={onClearActive}>
              Clear active key
            </Button>
          ) : undefined
        }
      >
        {list.isLoading && <LoadingSpinner label="Loading keys…" />}
        <ErrorBanner error={list.error} variant="inline" />
        {list.isSuccess && list.data.data.length === 0 && (
          <EmptyState
            title="No API keys yet"
            description="Create your first key above. The plaintext is returned exactly once."
          />
        )}
        {list.isSuccess && list.data.data.length > 0 && (
          <ul className="divide-y divide-slate-200" data-testid="keys-list">
            {list.data.data.map((key) => (
              <KeyRow
                key={key.id}
                apiKey={key}
                onRevoke={onRevoke}
                isRevoking={revokeMutation.isPending && revokeMutation.variables === key.id}
              />
            ))}
          </ul>
        )}
        <ErrorBanner error={revokeMutation.error} variant="inline" />
      </Card>
    </section>
  );
}

interface KeyRowProps {
  apiKey: ApiKey;
  onRevoke: (id: string) => Promise<void>;
  isRevoking: boolean;
}

function KeyRow({ apiKey, onRevoke, isRevoking }: KeyRowProps): JSX.Element {
  const isRevoked = apiKey.revokedAt !== null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900">
          {apiKey.name}
          {isRevoked && (
            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
              revoked
            </span>
          )}
        </p>
        <p className="font-mono text-xs text-slate-500">
          {truncate(apiKey.id, 18)} · {apiKey.prefix}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Created {formatDate(apiKey.createdAt)} · {formatTime(apiKey.createdAt)}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="danger"
          onClick={() => void onRevoke(apiKey.id)}
          disabled={isRevoked || isRevoking}
          aria-label={`Revoke key ${apiKey.name}`}
        >
          {isRevoking ? 'Revoking…' : isRevoked ? 'Revoked' : 'Revoke'}
        </Button>
      </div>
    </li>
  );
}
