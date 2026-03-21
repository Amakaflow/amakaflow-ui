/**
 * AMA-1131: Playwright screenshots for Coach Chat UI.
 *
 * Takes screenshots showing:
 * 1. Empty state with suggested prompts
 * 2. Active conversation with coach responses referencing workouts
 * 3. Source chips expanded
 * 4. Rate limit banner (8/10 used)
 * 5. Mobile view
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/coach-chat-preview.html';

test.describe('AMA-1131 Coach Chat Screenshots', () => {
  test('capture empty state with suggested prompts', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 812 });
    await page.goto(`${PREVIEW_URL}?mode=empty`);
    await page.waitForSelector('[data-testid="suggested-prompts"]');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: '/tmp/ama-1131-empty-state.png',
      fullPage: true,
    });

    // Verify suggested prompts are visible
    const prompts = page.getByTestId('suggested-prompt');
    await expect(prompts).toHaveCount(4);
  });

  test('capture active conversation with coach responses', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 812 });
    await page.goto(`${PREVIEW_URL}?mode=conversation`);
    await page.waitForSelector('[data-testid="chat-message-coach"]');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: '/tmp/ama-1131-conversation.png',
      fullPage: true,
    });

    // Verify coach messages exist
    const coachMessages = page.getByTestId('chat-message-coach');
    await expect(coachMessages.first()).toBeVisible();

    // Verify user messages exist
    const userMessages = page.getByTestId('chat-message-user');
    await expect(userMessages.first()).toBeVisible();

    // Verify coach avatar
    const avatar = page.getByTestId('coach-avatar');
    await expect(avatar.first()).toBeVisible();
  });

  test('capture source chips expanded', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 812 });
    await page.goto(`${PREVIEW_URL}?mode=sources`);
    await page.waitForSelector('[data-testid="chat-message-coach"]');

    // Wait for auto-expand
    await page.waitForTimeout(600);

    // Verify source chips are expanded
    await page.waitForSelector('[data-testid="source-chips-expanded"]');

    await page.screenshot({
      path: '/tmp/ama-1131-sources-expanded.png',
      fullPage: true,
    });

    const details = page.getByTestId('source-chip-detail');
    await expect(details.first()).toBeVisible();
  });

  test('capture rate limit banner', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 812 });
    await page.goto(`${PREVIEW_URL}?mode=rate-limit`);
    await page.waitForSelector('[data-testid="rate-limit-banner"]');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: '/tmp/ama-1131-rate-limit.png',
      fullPage: true,
    });

    // Verify rate limit text
    const banner = page.getByTestId('rate-limit-banner');
    await expect(banner).toContainText('8 of 10 free messages used');
  });

  test('capture mobile view', async ({ page }) => {
    // iPhone 14 Pro dimensions
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`${PREVIEW_URL}?mode=conversation`);
    await page.waitForSelector('[data-testid="chat-message-coach"]');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: '/tmp/ama-1131-mobile.png',
      fullPage: true,
    });
  });
});
