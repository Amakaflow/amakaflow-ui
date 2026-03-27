/**
 * AMA-1127: Playwright screenshots for Sync Dashboard.
 *
 * Takes screenshots showing:
 * 1. Desktop: full dashboard with all 3 sections
 * 2. Mobile: scrollable dashboard
 * 3. Pending decision cards expanded
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/sync-dashboard-preview.html';

test.describe('AMA-1127 Sync Dashboard Screenshots', () => {
  test('desktop: full dashboard with all 3 sections', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(PREVIEW_URL);
    await page.waitForSelector('[data-testid="sync-dashboard"]');
    await page.waitForSelector('[data-testid="integration-status-section"]');
    await page.waitForSelector('[data-testid="activity-feed-section"]');
    await page.waitForSelector('[data-testid="pending-decisions-section"]');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: '/tmp/ama-1127-desktop-full.png',
      fullPage: true,
    });

    // Verify all sections present
    await expect(page.getByTestId('integration-status-section')).toBeVisible();
    await expect(page.getByTestId('activity-feed-section')).toBeVisible();
    await expect(page.getByTestId('pending-decisions-section')).toBeVisible();

    // Verify integration status bars
    await expect(page.getByTestId('integration-status-stryd')).toBeVisible();
    await expect(page.getByTestId('integration-status-garmin')).toBeVisible();
    await expect(page.getByTestId('integration-status-strava')).toBeVisible();
  });

  test('mobile: scrollable dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(PREVIEW_URL);
    await page.waitForSelector('[data-testid="sync-dashboard"]');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: '/tmp/ama-1127-mobile.png',
      fullPage: true,
    });

    // Verify dashboard renders on mobile
    await expect(page.getByTestId('sync-dashboard')).toBeVisible();
    await expect(page.getByTestId('dashboard-summary')).toBeVisible();
  });

  test('pending decision cards with action buttons', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(PREVIEW_URL);
    await page.waitForSelector('[data-testid="decision-card-dec-001"]');
    await page.waitForTimeout(500);

    // Scroll to pending decisions section
    await page.getByTestId('pending-decisions-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: '/tmp/ama-1127-pending-decisions.png',
      fullPage: false,
      clip: await page.getByTestId('pending-decisions-section').boundingBox() ?? undefined,
    });

    // Verify decision cards have action buttons
    await expect(page.getByTestId('decision-action-move')).toBeVisible();
    await expect(page.getByTestId('decision-action-keep')).toBeVisible();
    await expect(page.getByTestId('decision-action-skip')).toBeVisible();

    // Verify rationale is visible
    await expect(page.getByTestId('decision-card-dec-001').getByTestId('decision-rationale')).toBeVisible();
  });
});
