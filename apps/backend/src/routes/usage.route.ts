// `GET /v1/usage/me` \u2014 the authenticated caller's usage summary.
//
// Aggregates per-minute windows persisted by the chat-completions route into
// totals + a sorted (newest first) `windows[]`. The cap on history makes the
// JSON small enough for the dashboard to poll every few seconds.

import { ERROR_CODE, UsageSummary, type UsageSummary as UsageSummaryType } from '@cosmic/shared';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { DomainError } from '../errors/domain-error.js';

const HISTORY_LIMIT = 24;

export const usageRoute: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    '/usage/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Usage'],
        summary: 'Per-API-key usage summary for the caller',
        description:
          'Returns totals (requests / promptTokens / completionTokens) plus the most recent windows (default capped at 24).',
        response: { 200: UsageSummary },
      },
    },
    async (request): Promise<UsageSummaryType> => {
      const apiKey = request.apiKey;
      if (!apiKey) {
        throw new DomainError({
          statusCode: 401,
          code: ERROR_CODE.apiKeyMissing,
          message: 'Authenticated key context is missing.',
        });
      }

      let requests = 0;
      let promptTokens = 0;
      let completionTokens = 0;
      const windows: UsageSummaryType['windows'] = [];
      for await (const record of app.state.usage.listForKey(apiKey.id)) {
        requests += record.requests;
        promptTokens += record.promptTokens;
        completionTokens += record.completionTokens;
        windows.push({
          windowStart: record.windowStart,
          requests: record.requests,
          promptTokens: record.promptTokens,
          completionTokens: record.completionTokens,
        });
      }

      // Newest first; cap to keep the JSON small for the dashboard poll.
      windows.sort((a, b) => b.windowStart.localeCompare(a.windowStart));
      return {
        apiKeyId: apiKey.id,
        totals: { requests, promptTokens, completionTokens },
        windows: windows.slice(0, HISTORY_LIMIT),
      };
    },
  );
};
