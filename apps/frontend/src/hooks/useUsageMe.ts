import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { UsageSummary } from '@cosmic/shared';

import { apiClient } from '../lib/api-client.js';
import { config } from '../lib/config.js';
import { useActiveApiKey } from './useActiveApiKey.js';

export const USAGE_QUERY_KEY = ['usage', 'me'] as const;

export function useUsageMe(): UseQueryResult<UsageSummary, Error> {
  const apiKey = useActiveApiKey();
  return useQuery<UsageSummary, Error>({
    queryKey: [...USAGE_QUERY_KEY, apiKey ?? 'unauth'],
    queryFn: ({ signal }) => apiClient.usageMe(apiKey as string, signal),
    enabled: apiKey !== null,
    refetchInterval: config.usageRefreshMs,
  });
}
