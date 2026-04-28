import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { HealthResponse } from '@cosmic/shared';

import { apiClient } from '../lib/api-client.js';
import { config } from '../lib/config.js';

export const HEALTH_QUERY_KEY = ['health'] as const;

export function useHealth(): UseQueryResult<HealthResponse, Error> {
  return useQuery<HealthResponse, Error>({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: ({ signal }) => apiClient.health(signal),
    refetchInterval: config.healthRefreshMs,
  });
}
