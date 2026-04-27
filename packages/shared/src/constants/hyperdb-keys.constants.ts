/**
 * Namespace prefixes for distributed-state keys.
 * All accessors must use these prefixes to keep the key-space organised
 * and allow targeted prefix scans.
 */
export const HYPERDB_PREFIX = {
  apiKey: 'api-keys/',
  worker: 'workers/',
  job: 'jobs/',
  usage: 'usage/',
} as const;

export type HyperdbPrefix = (typeof HYPERDB_PREFIX)[keyof typeof HYPERDB_PREFIX];
