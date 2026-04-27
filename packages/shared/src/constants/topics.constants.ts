/**
 * P2P discovery topic constants.
 *
 * The 32-byte topic is the *only* discovery key all nodes (backend + workers)
 * must agree on. In production it is provided via the `P2P_DISCOVERY_TOPIC`
 * environment variable. This module exposes a deterministic fallback for
 * dev/tests so a swarm can boot without configuration, plus a helper that
 * decodes a Base64 env value into a 32-byte buffer with validation.
 */

const TOPIC_BYTE_LENGTH = 32;

/** Deterministic 32-byte topic for dev/tests (NEVER use in production). */
export const DEFAULT_DISCOVERY_TOPIC: Uint8Array = new TextEncoder().encode(
  'cosmic-gpu-cloud-default-topic-1',
);

/** Decode a Base64 env value into a 32-byte topic buffer. */
export function decodeDiscoveryTopic(base64: string): Uint8Array {
  const buf = Buffer.from(base64, 'base64');
  if (buf.byteLength !== TOPIC_BYTE_LENGTH) {
    throw new Error(
      `P2P discovery topic must be exactly ${TOPIC_BYTE_LENGTH} bytes; got ${buf.byteLength}`,
    );
  }
  return new Uint8Array(buf);
}
