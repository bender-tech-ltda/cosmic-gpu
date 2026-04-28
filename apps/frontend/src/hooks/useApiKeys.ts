import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { ApiKeyCreatedResponse, ApiKeyList, CreateApiKeyBody } from '@cosmic/shared';

import { apiClient } from '../lib/api-client.js';

export const API_KEYS_QUERY_KEY = ['api-keys'] as const;

export function useApiKeys(): UseQueryResult<ApiKeyList, Error> {
  return useQuery<ApiKeyList, Error>({
    queryKey: API_KEYS_QUERY_KEY,
    queryFn: ({ signal }) => apiClient.listApiKeys(signal),
  });
}

export function useCreateApiKey(): UseMutationResult<
  ApiKeyCreatedResponse,
  Error,
  CreateApiKeyBody
> {
  const qc = useQueryClient();
  return useMutation<ApiKeyCreatedResponse, Error, CreateApiKeyBody>({
    mutationFn: (input) => apiClient.createApiKey(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
    },
  });
}

export function useRevokeApiKey(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiClient.revokeApiKey(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
    },
  });
}
