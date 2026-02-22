/**
 * Authenticated Fetch Utility
 *
 * Provides a fetch wrapper that automatically adds Clerk JWT to all API requests.
 * This enables secure communication with backend APIs that require authentication.
 *
 * Usage:
 *   import { createAuthenticatedFetch } from './authenticated-fetch';
 *
 *   // In a React component with access to Clerk auth:
 *   const { getToken } = useAuth();
 *   const authFetch = createAuthenticatedFetch(getToken);
 *   const response = await authFetch('/api/workouts', { method: 'GET' });
 */

type GetTokenFn = () => Promise<string | null>;

// Global token getter - set by AuthProvider when app initializes
let globalGetToken: GetTokenFn | null = null;

/**
 * Set the global token getter function.
 * Called by AuthProvider on mount.
 */
export function setGlobalTokenGetter(getToken: GetTokenFn) {
  globalGetToken = getToken;
}

/**
 * Get the current auth token.
 * Returns null if no token getter is configured.
 */
export async function getAuthToken(): Promise<string | null> {
  if (!globalGetToken) {
    console.warn('Auth token getter not configured. API calls will be unauthenticated.');
    return null;
  }
  return globalGetToken();
}

/**
 * Fetch wrapper that adds Authorization header with Clerk JWT.
 * Falls back to unauthenticated request if no token is available.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();

  const headers = new Headers(options.headers);

  if (token) {
    // Authenticated via Clerk JWT
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    // Dev mode fallback: send X-API-Key when no Clerk token is available
    const devApiKey = import.meta.env.VITE_DEV_API_KEY;
    if (devApiKey) {
      headers.set('X-API-Key', devApiKey);
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Create an authenticated fetch function with a specific token getter.
 * Useful for components that need to manage their own token lifecycle.
 */
export function createAuthenticatedFetch(getToken: GetTokenFn) {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = await getToken();

    const headers = new Headers(options.headers);

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };
}

/**
 * JSON API call helper with authentication.
 * Automatically adds Content-Type header for non-FormData requests.
 */
export async function authenticatedApiCall<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  // Add Content-Type for non-FormData requests
  if (!(options.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const response = await authenticatedFetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: response.statusText,
    }));
    throw new Error(error.detail || `API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
