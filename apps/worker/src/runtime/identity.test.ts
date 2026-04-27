import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  WorkerIdentityError,
  createEphemeralIdentity,
  loadOrGenerateIdentity,
} from './identity.js';

describe('worker identity', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cosmic-worker-id-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('generates and persists a seed on first run', async () => {
    const filePath = path.join(dir, 'worker.keypair');
    const id = await loadOrGenerateIdentity(filePath);
    expect(id.publicKey).toHaveLength(32);
    expect(id.secretKey).toHaveLength(64);
    expect(id.publicKeyHex).toHaveLength(64);
    expect(id.publicKeyShort.endsWith('…')).toBe(true);

    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(typeof parsed.seed).toBe('string');
    expect(parsed.publicKey).toBeUndefined();
    expect(parsed.secretKey).toBeUndefined();
    expect(Buffer.from(parsed.seed as string, 'base64')).toHaveLength(32);
  });

  it('loads the same keypair on subsequent runs', async () => {
    const filePath = path.join(dir, 'worker.keypair');
    const first = await loadOrGenerateIdentity(filePath);
    const second = await loadOrGenerateIdentity(filePath);
    expect(second.publicKeyHex).toBe(first.publicKeyHex);
    expect(second.secretKey.equals(first.secretKey)).toBe(true);
  });

  it('rejects a non-JSON identity file', async () => {
    const filePath = path.join(dir, 'worker.keypair');
    await writeFile(filePath, 'not json', 'utf8');
    await expect(loadOrGenerateIdentity(filePath)).rejects.toBeInstanceOf(WorkerIdentityError);
  });

  it('rejects an identity file missing the seed field', async () => {
    const filePath = path.join(dir, 'worker.keypair');
    await writeFile(filePath, JSON.stringify({ publicKey: 'legacy' }), 'utf8');
    await expect(loadOrGenerateIdentity(filePath)).rejects.toBeInstanceOf(WorkerIdentityError);
  });

  it('rejects a wrong-length seed', async () => {
    const filePath = path.join(dir, 'worker.keypair');
    await writeFile(
      filePath,
      JSON.stringify({ seed: Buffer.alloc(16).toString('base64') }),
      'utf8',
    );
    await expect(loadOrGenerateIdentity(filePath)).rejects.toBeInstanceOf(WorkerIdentityError);
  });

  it('createEphemeralIdentity returns a fresh keypair without persisting', () => {
    const a = createEphemeralIdentity();
    const b = createEphemeralIdentity();
    expect(a.publicKey).toHaveLength(32);
    expect(a.secretKey).toHaveLength(64);
    expect(a.publicKeyHex).not.toBe(b.publicKeyHex);
  });
});
