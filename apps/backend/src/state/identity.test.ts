import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createEphemeralIdentity, loadOrGenerateIdentity } from './identity.js';
import { StateError } from './types.js';

describe('identity', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cosmic-identity-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('generates and persists a keypair on first run', async () => {
    const filePath = path.join(dir, 'node.keypair');
    const id = await loadOrGenerateIdentity(filePath);
    expect(id.publicKey).toHaveLength(32);
    expect(id.publicKeyHex).toHaveLength(64);
    expect(id.publicKeyShort.endsWith('…')).toBe(true);
  });

  it('loads the same identity on subsequent runs', async () => {
    const filePath = path.join(dir, 'node.keypair');
    const first = await loadOrGenerateIdentity(filePath);
    const second = await loadOrGenerateIdentity(filePath);
    expect(second.publicKeyHex).toBe(first.publicKeyHex);
  });

  it('rejects a malformed identity file', async () => {
    const filePath = path.join(dir, 'node.keypair');
    await writeFile(filePath, 'not json', 'utf8');
    await expect(loadOrGenerateIdentity(filePath)).rejects.toBeInstanceOf(StateError);
  });

  it('createEphemeralIdentity returns a fresh 32-byte key without persisting', async () => {
    const a = createEphemeralIdentity();
    const b = createEphemeralIdentity();
    expect(a.publicKey).toHaveLength(32);
    expect(a.publicKeyHex).not.toBe(b.publicKeyHex);
  });
});
