import { Type, type Static } from '@sinclair/typebox';

export const UsageWindow = Type.Object({
  windowStart: Type.String({ format: 'date-time' }),
  requests: Type.Integer({ minimum: 0 }),
  promptTokens: Type.Integer({ minimum: 0 }),
  completionTokens: Type.Integer({ minimum: 0 }),
});
export type UsageWindow = Static<typeof UsageWindow>;

export const UsageSummary = Type.Object({
  apiKeyId: Type.String(),
  totals: Type.Object({
    requests: Type.Integer({ minimum: 0 }),
    promptTokens: Type.Integer({ minimum: 0 }),
    completionTokens: Type.Integer({ minimum: 0 }),
  }),
  windows: Type.Array(UsageWindow),
});
export type UsageSummary = Static<typeof UsageSummary>;
