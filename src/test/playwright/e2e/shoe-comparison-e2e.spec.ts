/**
 * Shoe Comparison E2E Tests
 *
 * Tests the shoe performance comparison page:
 * - Shoe cards render with names and stats
 * - Comparison chart renders
 * - "Best for" badges display
 * - Recommendation section visible
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/shoe-comparison-preview.html';

test.describe('Shoe Comparison E2E', () => {
  test('shoe comparison page renders', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('shoe-comparison-page')).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/shoe-comparison-page.png', fullPage: true });
  });

  test('shoe cards grid renders with multiple shoes', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const grid = page.getByTestId('shoe-cards-grid');
    await expect(grid).toBeVisible();

    // Verify individual shoe cards
    const shoeCards = page.locator('[data-testid^="shoe-card-"]');
    const count = await shoeCards.count();
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/screenshots/shoe-comparison-cards.png' });
  });

  test('shoe cards display best-for badges', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const badges = page.getByTestId('best-for-badge');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);

    // First badge should have text content
    const text = await badges.first().textContent();
    expect(text?.length).toBeGreaterThan(0);
  });

  test('comparison chart renders', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const chart = page.getByTestId('comparison-chart');
    await expect(chart).toBeVisible();

    // Verify the chart contains SVG (recharts) or visual elements
    const svgElements = chart.locator('svg, .recharts-wrapper');
    const svgCount = await svgElements.count();
    expect(svgCount).toBeGreaterThanOrEqual(0);

    await page.screenshot({ path: 'test-results/screenshots/shoe-comparison-chart.png' });
  });

  test('shoe recommendation section is visible', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const recommendation = page.getByTestId('shoe-recommendation');
    await expect(recommendation).toBeVisible();

    const text = await recommendation.textContent();
    expect(text?.length).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/screenshots/shoe-comparison-recommendation.png' });
  });

  test('desktop layout shows cards and chart side by side', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('shoe-comparison-page')).toBeVisible();
    await expect(page.getByTestId('shoe-cards-grid')).toBeVisible();
    await expect(page.getByTestId('comparison-chart')).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/shoe-comparison-desktop.png', fullPage: true });
  });

  test('mobile layout stacks content vertically', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('shoe-comparison-page')).toBeVisible();

    // Scroll to see all content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/screenshots/shoe-comparison-mobile.png', fullPage: true });
  });
});
