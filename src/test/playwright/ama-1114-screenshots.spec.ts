/**
 * AMA-1114: Playwright screenshots for Fatigue Advisor UI.
 *
 * Takes screenshots showing:
 * 1. Empty state with body map selector
 * 2. Response view with structured advice sections
 * 3. Loading skeleton
 * 4. Response-only (just the FatigueResponse component)
 * 5. Mobile view
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/fatigue-advisor-preview.html';

test.describe('AMA-1114 Fatigue Advisor Screenshots', () => {
  test('capture empty state with body map', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 812 });
    await page.goto(`${PREVIEW_URL}?mode=empty`);
    await page.waitForSelector('[data-testid="fatigue-advisor-page"]');
    await page.waitForSelector('[data-testid="body-map-selector"]');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: '/tmp/ama-1114-empty-bodymap.png',
      fullPage: true,
    });

    // Verify body map is visible
    const bodyMap = page.getByTestId('body-map-selector');
    await expect(bodyMap).toBeVisible();

    // Verify muscle groups exist
    const quads = page.getByTestId('muscle-group-quads');
    await expect(quads).toBeVisible();
  });

  test('capture response view with structured advice', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 812 });
    await page.goto(`${PREVIEW_URL}?mode=response`);
    await page.waitForSelector('[data-testid="fatigue-response"]');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: '/tmp/ama-1114-response.png',
      fullPage: true,
    });

    // Verify all sections are present
    await expect(page.getByTestId('fatigue-cause')).toBeVisible();
    await expect(page.getByTestId('fatigue-recovery')).toBeVisible();
    await expect(page.getByTestId('fatigue-programming')).toBeVisible();
    await expect(page.getByTestId('fatigue-exercises')).toBeVisible();
    await expect(page.getByTestId('fatigue-rest')).toBeVisible();

    // Verify question is shown
    await expect(page.getByTestId('fatigue-question-display')).toBeVisible();
  });

  test('capture loading state', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 812 });
    await page.goto(`${PREVIEW_URL}?mode=loading`);
    await page.waitForSelector('[data-testid="fatigue-loading"]');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: '/tmp/ama-1114-loading.png',
      fullPage: true,
    });
  });

  test('capture response-only component', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 812 });
    await page.goto(`${PREVIEW_URL}?mode=response-only`);
    await page.waitForSelector('[data-testid="fatigue-response"]');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: '/tmp/ama-1114-response-only.png',
      fullPage: true,
    });
  });

  test('capture mobile view', async ({ page }) => {
    // iPhone 14 Pro dimensions
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`${PREVIEW_URL}?mode=response`);
    await page.waitForSelector('[data-testid="fatigue-response"]');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: '/tmp/ama-1114-mobile.png',
      fullPage: true,
    });
  });
});
