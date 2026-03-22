/**
 * AMA-1154: Playwright screenshots for Live Progress View.
 *
 * Takes screenshots showing:
 * 1. Progress in motion (steps completing)
 * 2. All steps completed
 * 3. Mobile view
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/progress-preview.html';

test.describe('AMA-1154 Progress View Screenshots', () => {
  test('capture progress in motion', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForSelector('[data-testid="preview-title"]');

    // Click "Generate my week" to start progress
    await page.getByTestId('demo-generate-btn').click();

    // Wait for overlay to appear
    await expect(page.getByTestId('progress-overlay')).toBeVisible();

    // Wait a bit so some steps complete but not all
    await page.waitForTimeout(2500);

    // Screenshot 1: Progress in motion
    await page.screenshot({
      path: '/tmp/ama-1154-progress-in-motion.png',
      fullPage: true,
    });
  });

  test('capture all steps completed', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForSelector('[data-testid="preview-title"]');

    // Start progress
    await page.getByTestId('demo-generate-btn').click();
    await expect(page.getByTestId('progress-overlay')).toBeVisible();

    // Wait for all steps to complete (5 steps * ~1200ms + buffer)
    await expect(page.getByTestId('progress-done-label')).toBeVisible({ timeout: 15000 });

    // Screenshot 2: All steps completed
    await page.screenshot({
      path: '/tmp/ama-1154-progress-completed.png',
      fullPage: true,
    });
  });

  test('capture mobile view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(PREVIEW_URL);
    await page.waitForSelector('[data-testid="preview-title"]');

    // Start progress
    await page.getByTestId('demo-generate-btn').click();
    await expect(page.getByTestId('progress-overlay')).toBeVisible();

    // Wait for a couple steps
    await page.waitForTimeout(3000);

    // Screenshot 3: Mobile view
    await page.screenshot({
      path: '/tmp/ama-1154-progress-mobile.png',
      fullPage: true,
    });
  });
});
