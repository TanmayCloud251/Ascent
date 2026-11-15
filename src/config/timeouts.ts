// Unified timeout and retry configurations across client and server
export const TIMEOUT_CONFIG = {
  // Client-side AbortController timeout for heavy LLM operations (generate-module-content, generate-page, review-submission)
  CLIENT_FETCH_TIMEOUT_MS: 120_000, // 120 seconds

  // Client-side timeout for specification synthesis
  CLIENT_SPEC_TIMEOUT_MS: 90_000, // 90 seconds

  // Server-side overall budget for generate + verify + repair sequence
  SERVER_OVERALL_BUDGET_MS: 110_000, // 110 seconds

  // Individual Gemini API call timeout
  SERVER_GEMINI_CALL_TIMEOUT_MS: 60_000, // 60 seconds

  // Express HTTP server socket / request timeout (must be >= 130 seconds)
  SERVER_REQUEST_TIMEOUT_MS: 130_000, // 130 seconds

  // Server transient retries configuration (transient errors only: 429, 500, 502, 503, 504, network, timeout)
  SERVER_MAX_TRANSIENT_RETRIES: 2, // 1 initial + up to 2 retries = 3 attempts total
  SERVER_BACKOFF_BASE_MS: 1_000, // 1s
  SERVER_BACKOFF_STEP2_MS: 3_000, // 3s
  SERVER_BACKOFF_JITTER_MAX_MS: 300 // up to 300ms random jitter
} as const

