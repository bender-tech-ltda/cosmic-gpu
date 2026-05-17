import { Type, type Static } from '@sinclair/typebox';

export const HealthResponse = Type.Object({
  status: Type.Union([Type.Literal('ok'), Type.Literal('degraded'), Type.Literal('error')]),
  uptimeSeconds: Type.Number({ minimum: 0 }),
  p2p: Type.Object({
    connected: Type.Boolean(),
    peers: Type.Integer({ minimum: 0 }),
  }),
  version: Type.String(),
});
export type HealthResponse = Static<typeof HealthResponse>;

export const ReadyResponse = Type.Object({
  status: Type.Union([Type.Literal('ready'), Type.Literal('not_ready')]),
  peers: Type.Integer({ minimum: 0 }),
  reason: Type.Optional(Type.String()),
});
export type ReadyResponse = Static<typeof ReadyResponse>;
