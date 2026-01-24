/**
 * E2E test setup file.
 *
 * This file runs before E2E tests to:
 * - Verify API connectivity
 * - Set up authentication
 * - Configure test timeouts
 */

import { beforeAll, afterAll } from 'vitest';

// =============================================================================
// API Connectivity Check
// =============================================================================

const API_BASE = import.meta.env.VITE_MAPPER_API_URL || 'http://localhost:8001';

async function checkApiConnectivity(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(
        `[E2E Setup] API health check returned ${response.status}. ` +
        `Some tests may be skipped.`
      );
    } else {
      console.log(`[E2E Setup] API available at ${API_BASE}`);
    }
  } catch (error) {
    console.warn(
      `[E2E Setup] Cannot connect to API at ${API_BASE}. ` +
      `E2E tests will be skipped. Error: ${error}`
    );
  }
}

// =============================================================================
// Global Setup
// =============================================================================

beforeAll(async () => {
  console.log('[E2E Setup] Starting E2E test setup...');
  console.log(`[E2E Setup] API URL: ${API_BASE}`);

  await checkApiConnectivity();

  console.log('[E2E Setup] Setup complete.');
});

afterAll(() => {
  console.log('[E2E Setup] E2E tests complete.');
});

// =============================================================================
// Global Test Helpers
// =============================================================================

/**
 * Helper to skip test if API is not available.
 * Use in beforeEach to conditionally skip tests.
 */
export async function skipIfApiUnavailable(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return !response.ok;
  } catch {
    return true;
  }
}

/**
 * Wait for a condition with timeout.
 * Useful for waiting on async operations in E2E tests.
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 10000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
}

/**
 * Retry an async operation with exponential backoff.
 * Useful for flaky network operations.
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: { retries?: number; delay?: number } = {}
): Promise<T> {
  const { retries = 3, delay = 1000 } = options;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
}
