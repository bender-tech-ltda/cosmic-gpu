import { Type, type Static } from '@sinclair/typebox';

/**
 * Standard error response envelope. Every non-2xx HTTP response from the
 * backend uses this shape so the frontend can pattern-match on `code`.
 */
export const ApiErrorBody = Type.Object({
  statusCode: Type.Integer({ minimum: 400, maximum: 599 }),
  code: Type.String({
    description: 'Stable error code from @cosmic/shared/errors',
    examples: ['ApiKeyInvalid', 'RateLimited'],
  }),
  message: Type.String({ description: 'Human-readable explanation' }),
  requestId: Type.Optional(Type.String()),
  details: Type.Optional(Type.Unknown()),
});
export type ApiErrorBody = Static<typeof ApiErrorBody>;
