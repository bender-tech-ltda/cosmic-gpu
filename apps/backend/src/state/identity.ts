// Node identity: a stable 32-byte public key, persisted across restarts.
// Step 5 will integrate with Hyperswarm's keypair if needed; for now the
// public key is treated as an opaque node identifier.

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { StateError } from './types.js';

const PUBLIC_KEY_LENGTH = 32;

export interface NodeIdentity {
  /** Raw 32-byte identity public key. */
  publicKey: Buffer;
  /** Hex-encoded form for logs / DB keys. */
  publicKeyHex: string;
  /** First 8 hex chars + ellipsis — for safe display in logs and the UI. */
  publicKeyShort: string;
}

interface PersistedIdentity {
  publicKey: string;
}

function fromBuffer(publicKey: Buffer): NodeIdentity {
  const hex = publicKey.toString('hex');
  return {
    publicKey,
    publicKeyHex: hex,
    publicKeyShort: `${hex.slice(0, 8)}…`,
  };
}

/** In-memory identity for tests and ephemeral runs. Not persisted. */
export function createEphemeralIdentity(): NodeIdentity {
  return fromBuffer(randomBytes(PUBLIC_KEY_LENGTH));
}

/**
 * Load a persisted identity from `filePath`, or generate + persist a new one
 * if the file is missing. Throws `StateError` on a malformed file.
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
      typeof (parsed as PersistedIdentity).publicKey !== 'string'
    ) {
      throw new StateError(`identity file is malformed: ${filePath}`);
    }
    const publicKey = Buffer.from((parsed as PersistedIdentity).publicKey, 'base64');
    if (publicKey.length !== PUBLIC_KEY_LENGTH) {
      throw new StateError(
        `identity public key must be ${PUBLIC_KEY_LENGTH} bytes; got ${publicKey.length}`,
      );
    }
    return fromBuffer(publicKey);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    // File missing — generate, persist, return.
    const publicKey = randomBytes(PUBLIC_KEY_LENGTH);
    const persisted: PersistedIdentity = { publicKey: publicKey.toString('base64') };
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(persisted, null, 2), { mode: 0o600 });
    return fromBuffer(publicKey);
  }
}
