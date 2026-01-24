/**
 * Helper utilities for creating mock fetch Response objects in tests.
 */

/**
 * Create a mock Response object for testing.
 *
 * @param data - The data to return from response.json()
 * @param status - HTTP status code (default: 200)
 * @returns A mock Response object
 */
export function createMockResponse<T>(data: T, status = 200): Response {
  const ok = status >= 200 && status < 300;

  return {
    ok,
    status,
    statusText: getStatusText(status),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({ 'Content-Type': 'application/json' }),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: function () {
      return createMockResponse(data, status);
    },
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob([JSON.stringify(data)], { type: 'application/json' })),
    formData: () => Promise.reject(new Error('FormData not supported in mock')),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

/**
 * Create a mock error Response object for testing.
 *
 * @param status - HTTP status code
 * @param detail - Error detail message
 * @returns A mock error Response object
 */
export function createMockErrorResponse(status: number, detail: string): Response {
  return createMockResponse({ detail }, status);
}

/**
 * Create a mock Response that fails to parse JSON.
 *
 * @param status - HTTP status code
 * @returns A mock Response that throws on json()
 */
export function createMockMalformedResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: getStatusText(status),
    json: () => Promise.reject(new Error('Invalid JSON')),
    text: () => Promise.resolve('Not valid JSON'),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: function () {
      return createMockMalformedResponse(status);
    },
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.reject(new Error('FormData not supported')),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

/**
 * Get standard HTTP status text for a status code.
 */
function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return statusTexts[status] || 'Unknown';
}
