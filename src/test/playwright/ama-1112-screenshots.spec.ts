/**
 * AMA-1112: Playwright screenshots for Shoe Performance Comparison.
 *
 * Takes screenshots showing:
 * 1. Desktop: full page with shoe cards + chart
 * 2. Mobile: scrollable shoe comparison
 * 3. Comparison chart close-up
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/shoe-comparison-preview.html';

test.describe('AMA-1112 Shoe Comparison Screenshots', () => {
  test('desktop: full page with shoe cards and chart', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(PREVIEW_URL);
    await page.waitForSelector('[data-testid="shoe-comparison-page"]');
    await page.waitForSelector('[data-testid="comparison-chart"]');
    await page.waitForTimeout(800); // let recharts render

    await page.screenshot({
      path: '/tmp/ama-1112-desktop-full.png',
      fullPage: true,
    });

    // Verify all shoe cards present
    await expect(page.getByTestId('shoe-cards-grid')).toBeVisible();
    const cards = page.locator('[data-testid^="shoe-card-"]');
    await expect(cards).toHaveCount(3);

    // Verify chart and recommendation
    await expect(page.getByTestId('comparison-chart')).toBeVisible();
    await expect(page.getByTestId('shoe-recommendation')).toBeVisible();
  });

  test('mobile: scrollable shoe comparison', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(PREVIEW_URL);
    await page.waitForSelector('[data-testid="shoe-comparison-page"]');
    await page.waitForTimeout(800);

    await page.screenshot({
      path: '/tmp/ama-1112-mobile.png',
      fullPage: true,
    });

    await expect(page.getByTestId('shoe-comparison-page')).toBeVisible();
  });

  test('comparison chart close-up', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(PREVIEW_URL);
    await page.waitForSelector('[data-testid="comparison-chart"]');
    await page.waitForTimeout(800);

    await page.getByTestId('comparison-chart').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const box = await page.getByTestId('comparison-chart').boundingBox();
    await page.screenshot({
      path: '/tmp/ama-1112-chart.png',
      fullPage: false,
      clip: box ?? undefined,
    });

    await expect(page.getByTestId('comparison-chart')).toBeVisible();
  });
});
