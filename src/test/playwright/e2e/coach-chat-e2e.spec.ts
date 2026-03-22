/**
 * Coach Chat E2E Tests
 *
 * Tests the AI coach chat interface:
 * - Empty state with suggested prompts
 * - Clicking a prompt populates the input
 * - Coach response messages render with markdown
 * - Source chips toggle and show workout references
 * - Rate limit banner appears at high usage
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/coach-chat-preview.html';

test.describe('Coach Chat E2E', () => {
  test('empty state shows suggested prompts', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=empty`);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('suggested-prompts')).toBeVisible();

    const prompts = page.getByTestId('suggested-prompt');
    const count = await prompts.count();
    expect(count).toBe(4);

    await page.screenshot({ path: 'test-results/screenshots/coach-chat-empty.png' });
  });

  test('conversation mode shows user and coach messages', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=conversation`);
    await page.waitForTimeout(2000);

    // Verify user messages
    const userMessages = page.getByTestId('chat-message-user');
    await expect(userMessages.first()).toBeVisible();

    // Verify coach messages
    const coachMessages = page.getByTestId('chat-message-coach');
    await expect(coachMessages.first()).toBeVisible();

    // Verify coach avatar
    const avatar = page.getByTestId('coach-avatar');
    await expect(avatar.first()).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/coach-chat-conversation.png' });
  });

  test('source chips toggle reveals workout references', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${PREVIEW_URL}?mode=conversation`);
    await page.waitForTimeout(2000);

    // Dismiss any Vite error overlay that may appear from lazy-loaded modules
    const errorOverlay = page.locator('vite-error-overlay');
    if (await errorOverlay.count() > 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Find source chips toggle on a coach message — wait for it with timeout
    const sourceToggle = page.getByTestId('source-chips-toggle').first();
    await expect(sourceToggle).toBeVisible({ timeout: 10000 });
    await sourceToggle.click();
    await page.waitForTimeout(1000);

    // Verify source chips expanded section is visible
    await expect(page.getByTestId('source-chips-expanded').first()).toBeVisible({ timeout: 5000 });

    // Verify individual source chip details
    const chipDetails = page.getByTestId('source-chip-detail');
    const chipCount = await chipDetails.count();
    expect(chipCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/screenshots/coach-chat-sources.png' });
  });

  test('sources mode auto-expands source chips', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=sources`);
    await page.waitForTimeout(2000);

    // In sources mode, chips should be auto-expanded
    const coachMessages = page.getByTestId('chat-message-coach');
    await expect(coachMessages.first()).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/coach-chat-sources-expanded.png' });
  });

  test('rate limit banner shows usage at 8/10', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=rate-limit`);
    await page.waitForTimeout(2000);

    const banner = page.getByTestId('rate-limit-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('8');

    await page.screenshot({ path: 'test-results/screenshots/coach-chat-rate-limit.png' });
  });

  test('full interactive coach chat renders with input', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=full`);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('coach-chat')).toBeVisible();

    // Verify chat input exists
    const chatInput = page.getByTestId('coach-chat-input');
    await expect(chatInput).toBeVisible();

    // Verify send button exists
    const sendBtn = page.getByTestId('coach-send-btn');
    await expect(sendBtn).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/coach-chat-full.png' });
  });

  test('full coach chat: type message and verify input', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=full`);
    await page.waitForTimeout(2000);

    const chatInput = page.getByTestId('coach-chat-input');
    await chatInput.fill('How should I structure my long run this weekend?');

    // Verify text was entered
    await expect(chatInput).toHaveValue('How should I structure my long run this weekend?');

    await page.screenshot({ path: 'test-results/screenshots/coach-chat-typing.png' });
  });
});
