/**
 * AMA-1129: Training Preferences Page — Playwright screenshots
 *
 * Takes screenshots of the training preferences page in various states
 * for visual review during PR.
 *
 * Run: npx playwright test src/test/playwright/ama-1129-screenshots.spec.ts --project=chromium
 */
import { test } from '@playwright/test';

const BASE = 'http://localhost:3000/training-preferences-preview.html';

test.describe('AMA-1129 Training Preferences Screenshots', () => {
  test('Desktop — default state (all controls)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(`${BASE}?mode=default`);
    await page.waitForSelector('[data-testid="training-preferences-page"]');
    // Wait a beat for CSS to settle
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/ama-1129-desktop-default.png', fullPage: true });
    await context.close();
  });

  test('Mobile — default state', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(`${BASE}?mode=default`);
    await page.waitForSelector('[data-testid="training-preferences-page"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/ama-1129-mobile-default.png', fullPage: true });
    await context.close();
  });

  test('Desktop — custom volume + goal race with date', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(`${BASE}?mode=custom-volume`);
    // Must reload since localStorage is seeded by the preview on mount
    await page.reload();
    await page.waitForSelector('[data-testid="training-preferences-page"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/ama-1129-desktop-custom.png', fullPage: true });
    await context.close();
  });

  test('Mobile — custom volume + goal race with date', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(`${BASE}?mode=custom-volume`);
    await page.reload();
    await page.waitForSelector('[data-testid="training-preferences-page"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/ama-1129-mobile-custom.png', fullPage: true });
    await context.close();
  });
});
