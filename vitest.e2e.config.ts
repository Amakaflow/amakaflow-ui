/**
 * Vitest configuration for E2E and contract tests.
 *
 * This configuration is separate from unit tests and runs against
 * real services (mapper-api on port 8001).
 *
 * Usage:
 *   npm run test:e2e        - Run all E2E tests
 *   npm run test:e2e:smoke  - Run smoke tests only (@smoke tag)
 *   npm run test:contracts  - Run contract tests only (@contract tag)
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Include E2E and contract test files
    include: [
      'src/**/*.e2e.test.ts',
      'src/**/*.e2e.test.tsx',
      'src/**/*.contract.test.ts',
      'src/test/e2e/**/*.test.ts',
    ],

    // Exclude unit tests
    exclude: [
      'node_modules/**',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      '!src/**/*.e2e.test.ts',
      '!src/**/*.e2e.test.tsx',
      '!src/**/*.contract.test.ts',
    ],

    // Longer timeouts for E2E tests
    testTimeout: 30000, // 30 seconds per test
    hookTimeout: 60000, // 60 seconds for setup/teardown

    // Retry flaky tests once
    retry: 1,

    // Use forks for better isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        // Run E2E tests sequentially to avoid race conditions
        singleFork: true,
      },
    },

    // Environment
    environment: 'jsdom',

    // Globals
    globals: true,

    // Setup files
    setupFiles: ['./src/test/e2e-setup.ts'],

    // Environment variables for E2E
    env: {
      VITE_MAPPER_API_URL: process.env.VITE_MAPPER_API_URL || 'http://localhost:8001',
      VITE_E2E_MODE: 'true',
    },

    // Reporter configuration
    reporters: process.env.CI
      ? ['default', 'junit']
      : ['default'],

    outputFile: {
      junit: './test-results/e2e-results.xml',
    },

    // Coverage disabled for E2E tests (they test integration, not code paths)
    coverage: {
      enabled: false,
    },
  },
});
