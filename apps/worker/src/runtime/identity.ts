// Worker identity: stable ed25519 keypair derived from a persisted 32-byte
// seed at `NODE_KEYPAIR_PATH`. Mirrors `apps/backend/src/state/identity.ts`
// — kept as a small parallel implementation rather than extracting to a
// shared module, because the only thing the two would share is ~30 lines of
// fs+JSON code.

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import HyperDHT from 'hyperdht';
import path from 'node:path';

export class WorkerIdentityError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'WorkerIdentityError';
  }
}

const SEED_LENGTH = 32;
const PUBLIC_KEY_LENGTH = 32;
const SECRET_KEY_LENGTH = 64;

export interface WorkerIdentity {
  publicKey: Buffer;
  secretKey: Buffer;
  publicKeyHex: string;
  /** First 8 hex chars + ellipsis — for safe display in logs and the UI. */
  publicKeyShort: string;
}

interface PersistedIdentity {
  /** 32-byte ed25519 seed, base64-encoded. */
  seed: string;
}

function fromSeed(seed: Buffer): WorkerIdentity {
  const { publicKey, secretKey } = HyperDHT.keyPair(seed);
  if (publicKey.length !== PUBLIC_KEY_LENGTH) {
    throw new WorkerIdentityError(
      `derived public key must be ${PUBLIC_KEY_LENGTH} bytes; got ${publicKey.length}`,
    );
  }
  if (secretKey.length !== SECRET_KEY_LENGTH) {
    throw new WorkerIdentityError(
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
export function createEphemeralIdentity(): WorkerIdentity {
  return fromSeed(randomBytes(SEED_LENGTH));
}

/**
 * Load a persisted identity from `filePath`, or generate + persist a new one
 * if the file is missing. Throws `WorkerIdentityError` on a malformed shape.
 */
export async function loadOrGenerateIdentity(filePath: string): Promise<WorkerIdentity> {
  try {
    const raw = await readFile(filePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new WorkerIdentityError(`identity file is not valid JSON: ${filePath}`, err);
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as PersistedIdentity).seed !== 'string'
    ) {
      throw new WorkerIdentityError(
        `identity file is malformed: ${filePath} (expected { seed: <base64> })`,
      );
    }
    const seed = Buffer.from((parsed as PersistedIdentity).seed, 'base64');
    if (seed.length !== SEED_LENGTH) {
      throw new WorkerIdentityError(
        `identity seed must be ${SEED_LENGTH} bytes; got ${seed.length}`,
      );
    }
    return fromSeed(seed);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    const seed = randomBytes(SEED_LENGTH);
    const persisted: PersistedIdentity = { seed: seed.toString('base64') };
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(persisted, null, 2), { mode: 0o600 });
    return fromSeed(seed);
  }
}
