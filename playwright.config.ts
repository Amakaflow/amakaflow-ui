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

  // Default retries (overridden per project below).
  // AMA-1556: retries: 2 on a broken test costs 3× the timeout — use 0/1 per project.
  retries: 0,

  // GH ubuntu-latest is 4 vCPU; with dev server + MSW + Chromium, 2 workers
  // avoids CPU oversubscription. AMA-1556.
  workers: process.env.CI ? 2 : undefined,

  // Bail out of runaway failing runs in CI so a broken suite can't burn the whole timeout.
  maxFailures: process.env.CI ? 5 : 0,

  // Reporter configuration
  reporter: process.env.CI
    ? [['html'], ['junit', { outputFile: 'test-results/playwright-results.xml' }]]
    : [['html', { open: 'never' }]],

  // Global setup
  use: {
    // Base URL for navigation
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',

    // Collect trace on failure
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording
    video: 'retain-on-failure',
  },

  // Configure projects for different browsers
  projects: [
    // Blocker smoke — must always pass on every PR. Tagged @blocker.
    // Required CI check. retries: 0 — real failures should fail fast.
    // See src/test/playwright/README.md.
    {
      name: 'smoke-blocker',
      testMatch: /.*\.smoke\.spec\.ts/,
      grep: /@blocker/,
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone'],
      },
    },

    // Regression smoke — broader coverage. Tagged @regression (default for any
    // smoke test that isn't @blocker). Non-blocking in CI; flagged but doesn't
    // fail the PR. retries: 1 to absorb genuine flakiness.
    {
      name: 'smoke-regression',
      testMatch: /.*\.smoke\.spec\.ts/,
      grep: /@regression/,
      retries: 1,
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

    // E2E desktop (1280x800) - for comprehensive E2E tests
    {
      name: 'e2e-desktop',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },

    // E2E mobile (375x812) - for comprehensive E2E tests
    {
      name: 'e2e-mobile',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 375, height: 812 },
      },
    },
  ],

  // Web server to run before tests
  webServer: {
    // VITE_CHAT_BETA_PERIOD=false bypasses the beta-access gate so the
    // ChatPanel (and its voice button) renders for unauthenticated test users.
    // Without it, useChatFeatureFlags returns `chat_beta_period=true,
    // chat_beta_access=false` by default and ChatPanel renders ComingSoonBadge,
    // which has no trigger button (AMA-1581).
    command: 'VITE_DEMO_MODE=true VITE_CHAT_BETA_PERIOD=false npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
