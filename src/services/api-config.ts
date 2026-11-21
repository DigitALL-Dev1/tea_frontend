/**
 * Backend base URL used by every API client in src/services.
 * Override per environment with VITE_API_BASE_URL (see .env), e.g. http://127.0.0.1:8001 for a local backend.
 */
export const DEFAULT_API_BASE_URL = "http://10.1.1.17:8003";

export const API_BASE_URL = (
  (import.meta.env?.["VITE_API_BASE_URL"] as string | undefined) || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");
