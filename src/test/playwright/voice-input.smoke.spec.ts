/**
 * Voice Input Smoke Tests (AMA-435)
 *
 * These tests verify the critical path for voice input functionality.
 * Run on every PR to catch regressions early.
 *
 * Tags: @smoke
 *
 * Usage:
 *   npx playwright test --project=smoke
 *   npx playwright test voice-input.smoke.spec.ts
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { ChatPanelPage } from './pages/ChatPanelPage';
import {
  mockTranscribeSuccess,
  mockTranscribeHelloWorld,
} from './fixtures/voice-api.fixtures';

// Test selectors. The ChatPanel is collapsed by default — ChatPanelPage.goto
// handles opening it before waiting on the voice button.
const SELECTORS = {
  voiceButton: '[data-testid="chat-voice-button"]',
  textarea: '[data-testid="chat-input-textarea"]',
  sendButton: '[data-testid="chat-send-button"]',
} as const;

// Helper to mock the transcribe endpoint
async function mockTranscribeEndpoint(page: Page, response: object, status = 200) {
  await page.route('**/voice/transcribe', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

// Helper to wait for voice button state
async function waitForVoiceState(page: Page, state: string) {
  await expect(page.locator(SELECTORS.voiceButton))
    .toHaveAttribute('data-state', state, { timeout: 10_000 });
}

test.describe('Voice Input Smoke Tests', { tag: ['@smoke', '@regression'] }, () => {
  test.beforeEach(async ({ context }) => {
    // Grant microphone permission for all tests
    await context.grantPermissions(['microphone']);
  });

  test('SMOKE-1: complete recording flow - click to record to transcript', async ({ page }) => {
    // Setup: Mock the transcribe endpoint
    await mockTranscribeEndpoint(page, mockTranscribeHelloWorld);

    // Navigate and open ChatPanel so the voice button is mounted
    await new ChatPanelPage(page).goto();

    // Wait for the voice button to be in idle state
    const voiceButton = page.locator(SELECTORS.voiceButton);
    await waitForVoiceState(page, 'idle');

    // Step 1: Click to start recording
    await voiceButton.click();

    // Step 2: Verify transition to requesting then recording
    // The requesting state may be very brief, so we primarily check for recording
    await waitForVoiceState(page, 'recording');

    // Step 3: Verify visual indicators (pulsing dot should be present)
    // The button should have the recording class with red styling
    await expect(voiceButton).toHaveClass(/text-red-500/);

    // Step 4: Brief pause to simulate recording, then stop
    await page.waitForTimeout(500);
    await voiceButton.click();

    // Step 5: Verify transition to processing
    await waitForVoiceState(page, 'processing');

    // Step 6: Verify transition back to idle after transcription
    await waitForVoiceState(page, 'idle');

    // Step 7: Verify transcript appears in textarea
    const textarea = page.locator(SELECTORS.textarea);
    await expect(textarea).toHaveValue('hello world');

    // Step 8: Verify textarea has focus
    await expect(textarea).toBeFocused();

    // Step 9: Verify send button is now enabled
    const sendButton = page.locator(SELECTORS.sendButton);
    await expect(sendButton).toBeEnabled();
  });

  test('SMOKE-2: permission denied shows helpful error message', async ({ page, browser }) => {
    // Create a new context WITHOUT microphone permission
    const deniedContext = await browser.newContext({
      permissions: [], // No permissions granted
    });
    const deniedPage = await deniedContext.newPage();

    try {
      await deniedPage.goto('/');

      const voiceButton = deniedPage.locator(SELECTORS.voiceButton);

      // If the button exists (browser supports APIs but permission denied)
      if (await voiceButton.isVisible()) {
        await voiceButton.click();

        // Should transition to error state
        await waitForVoiceState(deniedPage, 'error');

        // Verify the tooltip/title contains helpful message
        const tooltip = await voiceButton.getAttribute('title');
        expect(tooltip).toMatch(/microphone|denied|access/i);
      }
    } finally {
      await deniedContext.close();
    }
  });

  test('SMOKE-3: transcript appends to existing textarea content', async ({ page }) => {
    // Setup: Mock the transcribe endpoint
    await mockTranscribeEndpoint(page, mockTranscribeSuccess);

    await new ChatPanelPage(page).goto();

    // Step 1: Type existing text in textarea
    const textarea = page.locator(SELECTORS.textarea);
    await textarea.fill('Today I did');

    // Step 2: Start voice recording
    const voiceButton = page.locator(SELECTORS.voiceButton);
    await voiceButton.click();
    await waitForVoiceState(page, 'recording');

    // Step 3: Stop recording
    await page.waitForTimeout(300);
    await voiceButton.click();

    // Step 4: Wait for transcription to complete
    await waitForVoiceState(page, 'idle');

    // Step 5: Verify text was appended with space separator
    // Expected: "Today I did 3 sets of 10 reps bench press"
    await expect(textarea).toHaveValue(/Today I did.*3 sets of 10 reps bench press/);

    // Step 6: Verify the space separator is present
    const value = await textarea.inputValue();
    expect(value).toBe('Today I did 3 sets of 10 reps bench press');
  });

  test('SMOKE-4: no auto-submit after transcription', async ({ page }) => {
    // Setup: Mock endpoint and track if chat was sent
    let chatSent = false;
    await page.route('**/chat/**', async (route) => {
      chatSent = true;
      await route.continue();
    });
    await mockTranscribeEndpoint(page, mockTranscribeHelloWorld);

    await new ChatPanelPage(page).goto();

    // Complete a recording
    const voiceButton = page.locator(SELECTORS.voiceButton);
    await voiceButton.click();
    await waitForVoiceState(page, 'recording');
    await page.waitForTimeout(300);
    await voiceButton.click();
    await waitForVoiceState(page, 'idle');

    // Verify transcript is in textarea
    await expect(page.locator(SELECTORS.textarea)).toHaveValue('hello world');

    // Verify no chat request was made (user must press Enter)
    expect(chatSent).toBe(false);

    // Verify send button is enabled but not auto-clicked
    await expect(page.locator(SELECTORS.sendButton)).toBeEnabled();
  });

  test('SMOKE-5: voice button shows correct visual states', async ({ page }) => {
    await mockTranscribeEndpoint(page, mockTranscribeHelloWorld);
    await new ChatPanelPage(page).goto();

    const voiceButton = page.locator(SELECTORS.voiceButton);

    // Initial state: idle with Mic icon
    await waitForVoiceState(page, 'idle');
    await expect(voiceButton.locator('svg')).toBeVisible();

    // Start recording
    await voiceButton.click();
    await waitForVoiceState(page, 'recording');

    // During recording: should show Square icon (stop button) and pulsing indicator
    await expect(voiceButton.locator('.animate-ping')).toBeVisible();

    // Stop recording
    await voiceButton.click();

    // Processing: should show Loader2 (spinner)
    await waitForVoiceState(page, 'processing');
    await expect(voiceButton.locator('.animate-spin')).toBeVisible();

    // Back to idle
    await waitForVoiceState(page, 'idle');
  });
});
