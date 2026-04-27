// HTTP and OpenAI-compatibility constants used by both backend and frontend.

/** Header used to convey the API key (Bearer token form). */
export const AUTH_HEADER = 'authorization';

/** Plaintext prefix for our keys (OpenAI-compatible). */
export const API_KEY_PREFIX = 'sk-';

/** Header for request correlation between client / backend / worker. */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Default model id served by the mock LLM. */
export const DEFAULT_MODEL_ID = 'mock-llm';

/** SSE protocol terminator (per OpenAI streaming convention). */
export const SSE_DONE_MARKER = '[DONE]';

/** SSE response content type. */
export const SSE_CONTENT_TYPE = 'text/event-stream';
