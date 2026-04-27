// TypeScript-friendly wrappers around the `compact-encoding` runtime library.
// These helpers exist so each schema file stays declarative and ~10 lines
// instead of ~30.
//
// SCHEMA EVOLUTION POLICY: APPEND-ONLY.
// Never reorder or remove fields — older replicas must still decode older
// buffers. Only ever add new fields at the END, and make them `optional()` so
// older writers (which won't include them) still produce valid wire frames.

import c, { type State } from 'compact-encoding';

export interface Codec<T> {
  preencode(state: State, value: T): void;
  encode(state: State, value: T): void;
  decode(state: State): T;
}

/** Encode a value to a `Uint8Array` using a Codec. */
export function encode<T>(codec: Codec<T>, value: T): Uint8Array {
  return c.encode(codec, value);
}

/** Decode a value from a `Uint8Array` using a Codec. */
export function decode<T>(codec: Codec<T>, buffer: Uint8Array): T {
  return c.decode(codec, buffer);
}

/**
 * Compose a struct codec from per-field codecs. The wire order is the
 * insertion order of the keys in the `fields` object literal.
 */
export function defineObject<T extends Record<string, unknown>>(fields: {
  [K in keyof T]: Codec<T[K]>;
}): Codec<T> {
  const keys = Object.keys(fields) as Array<keyof T>;
  return {
    preencode(state, value) {
      for (const k of keys) fields[k].preencode(state, value[k]);
    },
    encode(state, value) {
      for (const k of keys) fields[k].encode(state, value[k]);
    },
    decode(state) {
      const out = {} as T;
      for (const k of keys) {
        out[k] = fields[k].decode(state);
      }
      return out;
    },
  };
}

/** Length-prefixed array of items. */
export function array<T>(item: Codec<T>): Codec<T[]> {
  return c.array(item) as Codec<T[]>;
}

/**
 * Optional value: writes a 1-byte presence flag, then the value if present.
 * On decode, returns `undefined` when the flag is `false`.
 */
export function optional<T>(item: Codec<T>): Codec<T | undefined> {
  return {
    preencode(state, value) {
      cbool.preencode(state, value !== undefined);
      if (value !== undefined) item.preencode(state, value);
    },
    encode(state, value) {
      cbool.encode(state, value !== undefined);
      if (value !== undefined) item.encode(state, value);
    },
    decode(state) {
      const present = cbool.decode(state);
      return present ? item.decode(state) : undefined;
    },
  };
}

/**
 * Discriminated union over a `kind` literal field. Writes a 1-byte tag, then
 * delegates to the matching variant codec. Variant codecs MUST NOT include
 * the `kind` field themselves — this helper adds it on decode.
 */
export function taggedUnion<T extends { kind: string }>(variants: {
  [K in T['kind']]: Codec<Omit<Extract<T, { kind: K }>, 'kind'>>;
}): Codec<T> {
  const tags = Object.keys(variants) as Array<T['kind']>;
  const tagToIndex = new Map<T['kind'], number>(tags.map((t, i) => [t, i]));

  return {
    preencode(state, value) {
      cuint.preencode(state, tagToIndex.get(value.kind as T['kind']) ?? 0);
      const variant = variants[value.kind as T['kind']] as Codec<Record<string, unknown>>;
      const { kind: _kind, ...rest } = value as T & Record<string, unknown>;
      variant.preencode(state, rest);
    },
    encode(state, value) {
      cuint.encode(state, tagToIndex.get(value.kind as T['kind']) ?? 0);
      const variant = variants[value.kind as T['kind']] as Codec<Record<string, unknown>>;
      const { kind: _kind, ...rest } = value as T & Record<string, unknown>;
      variant.encode(state, rest);
    },
    decode(state) {
      const idx = cuint.decode(state);
      const tag = tags[idx];
      if (tag === undefined) {
        throw new Error(`taggedUnion: unknown tag index ${idx}`);
      }
      const variant = variants[tag] as Codec<Record<string, unknown>>;
      const inner = variant.decode(state);
      return { kind: tag, ...inner } as T;
    },
  };
}

// Re-exports of primitive codecs with stronger typings.
export const cstring: Codec<string> = c.string;
export const cuint: Codec<number> = c.uint;
export const cint: Codec<number> = c.int;
export const cbool: Codec<boolean> = c.bool;
