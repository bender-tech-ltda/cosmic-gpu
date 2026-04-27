import { ERROR_CODE } from '@cosmic/shared';
import { describe, expect, it } from 'vitest';

import type { DomainError } from '../errors/domain-error.js';
import { ApiKeysState } from '../state/api-keys.state.js';
import { InMemoryKvStore } from '../state/in-memory.adapter.js';
import { ApiKeysService } from './api-keys.service.js';

const SECRET = 'test-secret';

function buildService(): { service: ApiKeysService; state: ApiKeysState } {
  const state = new ApiKeysState(new InMemoryKvStore());
  return { service: new ApiKeysService(state, SECRET), state };
}

describe('ApiKeysService', () => {
  it('creates a record and returns plaintext exactly once', async () => {
    const { service, state } = buildService();
    const { record, plaintext } = await service.create({ name: 'cli' });

    expect(plaintext.startsWith('sk-')).toBe(true);
    expect(record.name).toBe('cli');
    expect(record.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(record.id).toMatch(/^ak_[0-9a-f]{16}$/);

    const reloaded = await state.findById(record.id);
    // Plaintext is never persisted.
    expect(JSON.stringify(reloaded)).not.toContain(plaintext);
    expect(reloaded?.keyHash).toBe(record.keyHash);
  });

  it('uses default scopes when none are provided', async () => {
    const { service } = buildService();
    const { record } = await service.create({ name: 'cli' });
    expect(record.scopes).toEqual(['inference:read']);
  });

  it('respects supplied scopes', async () => {
    const { service } = buildService();
    const { record } = await service.create({ name: 'cli', scopes: ['inference:write'] });
    expect(record.scopes).toEqual(['inference:write']);
  });

  it('list returns public-safe shape sorted desc by createdAt', async () => {
    const { service } = buildService();
    const a = await service.create({ name: 'a' });
    await new Promise((r) => setTimeout(r, 5));
    const b = await service.create({ name: 'b' });

    const list = await service.list();
    expect(list.map((k) => k.id)).toEqual([b.record.id, a.record.id]);
    for (const item of list) {
      expect((item as Record<string, unknown>).keyHash).toBeUndefined();
    }
  });

  it('revoke marks the record as revoked', async () => {
    const { service } = buildService();
    const { record } = await service.create({ name: 'k' });
    const revoked = await service.revoke(record.id);
    expect(revoked.revokedAt).not.toBeNull();
  });

  it('revoke throws apiKeyNotFound for an unknown id', async () => {
    const { service } = buildService();
    try {
      await service.revoke('ak_unknown');
      throw new Error('revoke should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe(ERROR_CODE.apiKeyNotFound);
      expect((err as DomainError).statusCode).toBe(404);
    }
  });

  it('authenticatePlaintext returns the record on success', async () => {
    const { service } = buildService();
    const { record, plaintext } = await service.create({ name: 'k' });
    const found = await service.authenticatePlaintext(plaintext);
    expect(found.id).toBe(record.id);
  });

  it('authenticatePlaintext throws apiKeyInvalid for an unknown plaintext', async () => {
    const { service } = buildService();
    await service.create({ name: 'k' });
    try {
      await service.authenticatePlaintext('sk-not-a-real-key');
      throw new Error('authenticatePlaintext should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe(ERROR_CODE.apiKeyInvalid);
    }
  });

  it('authenticatePlaintext throws apiKeyRevoked for a revoked key', async () => {
    const { service } = buildService();
    const { record, plaintext } = await service.create({ name: 'k' });
    await service.revoke(record.id);
    try {
      await service.authenticatePlaintext(plaintext);
      throw new Error('authenticatePlaintext should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe(ERROR_CODE.apiKeyRevoked);
      expect((err as DomainError).statusCode).toBe(403);
    }
  });
});
