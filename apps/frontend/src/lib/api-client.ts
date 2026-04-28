// Typed fetch wrapper around the backend HTTP API.
//
// Every method:
//   - Hits the configured `backendUrl` (empty in dev → Vite proxy).
//   - Threads the bearer key (when provided) into the `Authorization` header.
//   - Maps non-2xx JSON responses to `ApiError` (typed via `@cosmic/shared`).
//   - Maps network / non-JSON failures to a synthetic `ApiError` so consumers
//     handle a single error shape.
//
// All payload types come from `@cosmic/shared` so the frontend and backend
// can never drift.

import type {
  ApiErrorBody,
  ApiKeyCreatedResponse,
  ApiKeyList,
  ChatCompletion,
  ChatCompletionRequest,
  CreateApiKeyBody,
  HealthResponse,
  ListModelsResponse,
  MetricsResponse,
  UsageSummary,
} from '@cosmic/shared';

import { ApiError, networkError } from './api-error.js';
import { config } from './config.js';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  /** Bearer token. Omit for public endpoints. */
  apiKey?: string;
  signal?: AbortSignal;
  /** Override the default JSON Accept header (used by SSE). */
  headers?: Record<string, string>;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = `${config.backendUrl}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opts.headers,
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.apiKey) headers['Authorization'] = `Bearer ${opts.apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    throw networkError(err);
  }

  // 204 No Content (DELETE /v1/api-keys/:id success) — no body.
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Non-JSON body (rare; would imply a misconfigured upstream).
      throw networkError(
        new Error(`unexpected non-JSON response (${response.status})`),
        response.status,
      );
    }
  }

  if (!response.ok) {
    if (parsed && typeof parsed === 'object' && 'code' in parsed) {
      throw new ApiError(parsed as ApiErrorBody);
    }
    throw networkError(new Error(`HTTP ${response.status}`), response.status);
  }

  return parsed as T;
}

/** Public endpoints (no Bearer required). */
export const apiClient = {
  health(signal?: AbortSignal): Promise<HealthResponse> {
    return request<HealthResponse>('/health', { signal });
  },

  metrics(signal?: AbortSignal): Promise<MetricsResponse> {
    return request<MetricsResponse>('/metrics', { signal });
  },

  listModels(signal?: AbortSignal): Promise<ListModelsResponse> {
    return request<ListModelsResponse>('/v1/models', { signal });
  },

  // API key management is public for the take-home demo (per architecture
  // doc §4). Production hardening is captured under §6.
  createApiKey(body: CreateApiKeyBody): Promise<ApiKeyCreatedResponse> {
    return request<ApiKeyCreatedResponse>('/v1/api-keys', {
      method: 'POST',
      body,
    });
  },

  listApiKeys(signal?: AbortSignal): Promise<ApiKeyList> {
    return request<ApiKeyList>('/v1/api-keys', { signal });
  },

  revokeApiKey(id: string): Promise<void> {
    return request<void>(`/v1/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // Authenticated endpoints — the bearer key flows through the request
  // helper. `apiKey` is required for these.
  usageMe(apiKey: string, signal?: AbortSignal): Promise<UsageSummary> {
    return request<UsageSummary>('/v1/usage/me', { apiKey, signal });
  },

  chatCompletion(apiKey: string, body: ChatCompletionRequest): Promise<ChatCompletion> {
    return request<ChatCompletion>('/v1/chat/completions', {
      method: 'POST',
      apiKey,
      body: { ...body, stream: false },
    });
  },
};

export type ApiClient = typeof apiClient;
