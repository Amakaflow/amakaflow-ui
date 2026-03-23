/**
 * AMA-1180: Playwright screenshots for multi-source workout import.
 *
 * Takes screenshots showing:
 * 1. Import screen (empty + with URLs)
 * 2. Import in progress
 * 3. Block picker with source badges
 * 4. Follow-along merge player
 *
 * Desktop (1280x800) + Mobile (375x812) viewports.
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/multi-source-import-preview.html';

const SAMPLE_URLS = `https://www.instagram.com/reel/CxMobility01/
https://www.instagram.com/reel/CxMobility02/
https://www.youtube.com/watch?v=StrengthUpper01
https://www.youtube.com/watch?v=StrengthLower01
https://www.tiktok.com/@hyroxcoach/video/7298765432100`;

test.describe('AMA-1180 Multi-Source Import Screenshots', () => {
  // ── Desktop ─────────────────────────────────────────────────────────────

  test.describe('Desktop (1280x800)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
    });

    test('capture empty import screen', async ({ page }) => {
      await page.goto(PREVIEW_URL);
      await page.waitForTimeout(500);

      await page.screenshot({
        path: '/tmp/ama-1180-import-empty-desktop.png',
        fullPage: true,
      });

      // Verify key elements
      await expect(page.getByTestId('multi-source-textarea')).toBeVisible();
      await expect(page.getByTestId('import-all-button')).toBeVisible();
    });

    test('capture import with URLs pasted', async ({ page }) => {
      await page.goto(PREVIEW_URL);
      await page.waitForTimeout(500);

      const textarea = page.getByTestId('multi-source-textarea');
      await textarea.fill(SAMPLE_URLS);
      await page.waitForTimeout(300);

      await page.screenshot({
        path: '/tmp/ama-1180-import-urls-desktop.png',
        fullPage: true,
      });

      // Verify platform badges
      await expect(page.getByTestId('platform-badges')).toBeVisible();
      await expect(page.getByTestId('url-list')).toBeVisible();
    });

    test('capture block picker with source badges', async ({ page }) => {
      await page.goto(PREVIEW_URL);
      await page.waitForTimeout(500);

      // Navigate to block picker phase
      await page.getByTestId('phase-block-picker').click();
      await page.waitForTimeout(300);

      await page.screenshot({
        path: '/tmp/ama-1180-block-picker-desktop.png',
        fullPage: true,
      });

      // Verify source badges and select-all buttons
      await expect(page.getByTestId('block-picker')).toBeVisible();
      await expect(page.getByTestId('select-all-sources')).toBeVisible();
    });

    test('capture follow-along player', async ({ page }) => {
      await page.goto(PREVIEW_URL);
      await page.waitForTimeout(500);

      // Navigate to player phase
      await page.getByTestId('phase-player').click();
      await page.waitForTimeout(300);

      await page.screenshot({
        path: '/tmp/ama-1180-player-desktop.png',
        fullPage: true,
      });

      await expect(page.getByTestId('follow-along-player')).toBeVisible();
      await expect(page.getByTestId('block-timeline')).toBeVisible();
    });
  });

  // ── Mobile ──────────────────────────────────────────────────────────────

  test.describe('Mobile (375x812)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
    });

    test('capture empty import screen - mobile', async ({ page }) => {
      await page.goto(PREVIEW_URL);
      await page.waitForTimeout(500);

      await page.screenshot({
        path: '/tmp/ama-1180-import-empty-mobile.png',
        fullPage: true,
      });
    });

    test('capture import with URLs - mobile', async ({ page }) => {
      await page.goto(PREVIEW_URL);
      await page.waitForTimeout(500);

      const textarea = page.getByTestId('multi-source-textarea');
      await textarea.fill(SAMPLE_URLS);
      await page.waitForTimeout(300);

      await page.screenshot({
        path: '/tmp/ama-1180-import-urls-mobile.png',
        fullPage: true,
      });
    });

    test('capture block picker - mobile', async ({ page }) => {
      await page.goto(PREVIEW_URL);
      await page.waitForTimeout(500);

      await page.getByTestId('phase-block-picker').click();
      await page.waitForTimeout(300);

      await page.screenshot({
        path: '/tmp/ama-1180-block-picker-mobile.png',
        fullPage: true,
      });
    });

    test('capture follow-along player - mobile', async ({ page }) => {
      await page.goto(PREVIEW_URL);
      await page.waitForTimeout(500);

      await page.getByTestId('phase-player').click();
      await page.waitForTimeout(300);

      await page.screenshot({
        path: '/tmp/ama-1180-player-mobile.png',
        fullPage: true,
      });
    });
  });
});
