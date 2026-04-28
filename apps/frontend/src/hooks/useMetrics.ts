import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { MetricsResponse } from '@cosmic/shared';

import { apiClient } from '../lib/api-client.js';
import { config } from '../lib/config.js';

export const METRICS_QUERY_KEY = ['metrics'] as const;

export function useMetrics(): UseQueryResult<MetricsResponse, Error> {
  return useQuery<MetricsResponse, Error>({
    queryKey: METRICS_QUERY_KEY,
    queryFn: ({ signal }) => apiClient.metrics(signal),
    refetchInterval: config.metricsRefreshMs,
  });
}
