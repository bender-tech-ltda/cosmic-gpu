// Node identity: a stable ed25519 keypair derived from a persisted 32-byte
// seed at `NODE_KEYPAIR_PATH`. The seed is the only material on disk; the
// public/secret keys are derived on every boot via libsodium
// `crypto_sign_seed_keypair` (exposed as `HyperDHT.keyPair(seed)`). This
// shape is the canonical Holepunch identity pattern and lets Step 5 pass
// the keypair straight into Hyperswarm without rotating the worker registry's
// `workers/<pubkey>` rows on every restart.

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import HyperDHT from 'hyperdht';
import path from 'node:path';

import { StateError } from './types.js';

const SEED_LENGTH = 32;
const PUBLIC_KEY_LENGTH = 32;
const SECRET_KEY_LENGTH = 64;

export interface NodeIdentity {
  /** Raw 32-byte ed25519 public key. */
  publicKey: Buffer;
  /** 64-byte libsodium-format ed25519 secret key (seed + public key). */
  secretKey: Buffer;
  /** Hex-encoded public key, for logs and DB keys. */
  publicKeyHex: string;
  /** First 8 hex chars + ellipsis — for safe display in logs and the UI. */
  publicKeyShort: string;
}

interface PersistedIdentity {
  /** 32-byte ed25519 seed, base64-encoded. */
  seed: string;
}

function fromSeed(seed: Buffer): NodeIdentity {
  const { publicKey, secretKey } = HyperDHT.keyPair(seed);
  if (publicKey.length !== PUBLIC_KEY_LENGTH) {
    throw new StateError(
      `derived public key must be ${PUBLIC_KEY_LENGTH} bytes; got ${publicKey.length}`,
    );
  }
  if (secretKey.length !== SECRET_KEY_LENGTH) {
    throw new StateError(
      `derived secret key must be ${SECRET_KEY_LENGTH} bytes; got ${secretKey.length}`,
    );
  }
  const hex = publicKey.toString('hex');
  return {
    publicKey,
    secretKey,
    publicKeyHex: hex,
    publicKeyShort: `${hex.slice(0, 8)}…`,
  };
}

/** In-memory identity for tests and ephemeral runs. Not persisted. */
export function createEphemeralIdentity(): NodeIdentity {
  return fromSeed(randomBytes(SEED_LENGTH));
}

/**
 * Load a persisted identity from `filePath`, or generate + persist a new one
 * if the file is missing. Throws `StateError` on any malformed shape.
 */
export async function loadOrGenerateIdentity(filePath: string): Promise<NodeIdentity> {
  try {
    const raw = await readFile(filePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new StateError(`identity file is not valid JSON: ${filePath}`, err);
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as PersistedIdentity).seed !== 'string'
    ) {
      throw new StateError(`identity file is malformed: ${filePath} (expected { seed: <base64> })`);
    }
    const seed = Buffer.from((parsed as PersistedIdentity).seed, 'base64');
    if (seed.length !== SEED_LENGTH) {
      throw new StateError(`identity seed must be ${SEED_LENGTH} bytes; got ${seed.length}`);
    }
    return fromSeed(seed);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    // File missing — generate, persist, return.
    const seed = randomBytes(SEED_LENGTH);
    const persisted: PersistedIdentity = { seed: seed.toString('base64') };
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(persisted, null, 2), { mode: 0o600 });
    return fromSeed(seed);
  }
}
