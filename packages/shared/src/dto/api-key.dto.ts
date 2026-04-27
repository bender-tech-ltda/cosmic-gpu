import { Type, type Static } from '@sinclair/typebox';

export const CreateApiKeyBody = Type.Object({
  name: Type.String({
    description: 'Human-readable label for the API key',
    minLength: 1,
    maxLength: 64,
    examples: ['cli-laptop'],
  }),
  scopes: Type.Optional(
    Type.Array(Type.String(), {
      description: 'Allowed scopes; defaults to ["inference:read"]',
      examples: [['inference:read']],
    }),
  ),
});
export type CreateApiKeyBody = Static<typeof CreateApiKeyBody>;

/** Public-safe representation of an API key (plaintext is NEVER returned here). */
export const ApiKey = Type.Object({
  id: Type.String({
    description: 'Stable internal id',
    examples: ['ak_a1b2c3d4'],
  }),
  name: Type.String(),
  scopes: Type.Array(Type.String()),
  createdAt: Type.String({ format: 'date-time' }),
  revokedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()], {
    description: 'ISO timestamp when the key was revoked, or null when active',
  }),
  prefix: Type.String({
    description: 'First 8 chars of the plaintext, for UI hints',
    examples: ['sk-AbCd...'],
  }),
});
export type ApiKey = Static<typeof ApiKey>;

/** One-time creation response. The plaintext is included exactly once and never again. */
export const ApiKeyCreatedResponse = Type.Object({
  id: Type.String(),
  name: Type.String(),
  scopes: Type.Array(Type.String()),
  createdAt: Type.String({ format: 'date-time' }),
  revokedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  prefix: Type.String(),
  plaintext: Type.String({
    description:
      'The plaintext key. Returned ONLY at creation time. Store it securely; it cannot be retrieved later.',
    examples: ['sk-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfGh'],
  }),
});
export type ApiKeyCreatedResponse = Static<typeof ApiKeyCreatedResponse>;

export const ApiKeyList = Type.Object({
  data: Type.Array(ApiKey),
});
export type ApiKeyList = Static<typeof ApiKeyList>;
