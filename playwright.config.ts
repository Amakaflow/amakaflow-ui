/**
 * Playwright configuration for browser-level E2E tests.
 *
 * These tests run in real browsers and can access browser APIs
 * like MediaRecorder, getUserMedia, and Web Speech API.
 *
 * Usage:
 *   npx playwright test                    - Run all tests
 *   npx playwright test --project=chromium - Run in Chromium only
 *   npx playwright test --grep @smoke      - Run smoke tests only
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/test/playwright',

  // Global timeout per test
  timeout: 30_000,

  // Expect assertions timeout
  expect: {
    timeout: 5_000,
  },

  // Run tests in parallel by default (override for voice tests)
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in source
  forbidOnly: !!process.env.CI,

  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0,

  // Limit workers in CI for stability
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: process.env.CI
    ? [['html'], ['junit', { outputFile: 'test-results/playwright-results.xml' }]]
    : [['html', { open: 'never' }]],

  // Global setup
  use: {
    // Base URL for navigation
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',

    // Collect trace on failure
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording
    video: 'retain-on-failure',
  },

  // Configure projects for different browsers
  projects: [
    // Smoke tests - run on every PR (Chromium only for speed)
    {
      name: 'smoke',
      testMatch: /.*\.smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone'],
      },
    },

    // Accessibility regression tests - run on every PR alongside smoke
    {
      name: 'a11y',
      testMatch: /.*\.smoke\.spec\.ts/,
      grep: /@a11y/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // Full regression - Chromium
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone'],
      },
    },

    // Full regression - Firefox
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Note: Firefox handles permissions differently
      },
    },

    // Full regression - WebKit
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
    },

    // Mobile Chrome (voice input on mobile)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        permissions: ['microphone'],
      },
    },
  ],

  // Web server to run before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
