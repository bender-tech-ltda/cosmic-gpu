import { describe, expect, it } from 'vitest';

import { ApiKeysState, type ApiKeyRecord } from './api-keys.state.js';
import { InMemoryKvStore } from './in-memory.adapter.js';

const fixture = (overrides: Partial<ApiKeyRecord> = {}): ApiKeyRecord => ({
  id: 'ak_test',
  name: 'cli-laptop',
  keyHash: 'hash-1',
  prefix: 'sk-AbCd',
  scopes: ['inference:read'],
  createdAt: '2024-01-01T00:00:00.000Z',
  revokedAt: null,
  ...overrides,
});

describe('ApiKeysState', () => {
  it('creates a record and finds it by id', async () => {
    const state = new ApiKeysState(new InMemoryKvStore());
    const record = fixture();
    await state.create(record);
    expect(await state.findById(record.id)).toEqual(record);
  });

  it('finds a record by hash via prefix scan', async () => {
    const state = new ApiKeysState(new InMemoryKvStore());
    await state.create(fixture({ id: 'ak_a', keyHash: 'hash-a' }));
    await state.create(fixture({ id: 'ak_b', keyHash: 'hash-b' }));
    const found = await state.findByHash('hash-b');
    expect(found?.id).toBe('ak_b');
  });

  it('returns null when findByHash matches nothing', async () => {
    const state = new ApiKeysState(new InMemoryKvStore());
    await state.create(fixture());
    expect(await state.findByHash('nope')).toBeNull();
  });

  it('revoke sets revokedAt and persists', async () => {
    const state = new ApiKeysState(new InMemoryKvStore());
    const record = fixture();
    await state.create(record);

    const revoked = await state.revoke(record.id, '2024-06-01T00:00:00.000Z');
    expect(revoked?.revokedAt).toBe('2024-06-01T00:00:00.000Z');

    const reloaded = await state.findById(record.id);
    expect(reloaded?.revokedAt).toBe('2024-06-01T00:00:00.000Z');
  });

  it('revoke is idempotent', async () => {
    const state = new ApiKeysState(new InMemoryKvStore());
    const record = fixture({ revokedAt: '2024-01-02T00:00:00.000Z' });
    await state.create(record);

    const result = await state.revoke(record.id, '2024-06-01T00:00:00.000Z');
    expect(result?.revokedAt).toBe('2024-01-02T00:00:00.000Z');
  });

  it('list yields every record', async () => {
    const state = new ApiKeysState(new InMemoryKvStore());
    await state.create(fixture({ id: 'ak_a' }));
    await state.create(fixture({ id: 'ak_b' }));

    const ids: string[] = [];
    for await (const r of state.list()) ids.push(r.id);
    expect(ids.sort()).toEqual(['ak_a', 'ak_b']);
  });
});
