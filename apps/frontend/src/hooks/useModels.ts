import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ListModelsResponse } from '@cosmic/shared';

import { apiClient } from '../lib/api-client.js';

export const MODELS_QUERY_KEY = ['models'] as const;

export function useModels(): UseQueryResult<ListModelsResponse, Error> {
  return useQuery<ListModelsResponse, Error>({
    queryKey: MODELS_QUERY_KEY,
    queryFn: ({ signal }) => apiClient.listModels(signal),
  });
}
