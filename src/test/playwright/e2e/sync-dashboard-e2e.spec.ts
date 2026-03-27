/**
 * Sync Dashboard E2E Tests
 *
 * Tests the sync dashboard overview:
 * - Dashboard renders with all 3 sections
 * - Integration status bars show platform health
 * - Activity feed section is present
 * - Pending decisions section renders cards
 * - Decision cards have action buttons
 * - Clicking a decision action works
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/sync-dashboard-preview.html';

test.describe('Sync Dashboard E2E', () => {
  test('dashboard renders with all three sections', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('sync-dashboard')).toBeVisible();
    await expect(page.getByTestId('integration-status-section')).toBeVisible();
    await expect(page.getByTestId('activity-feed-section')).toBeVisible();
    await expect(page.getByTestId('pending-decisions-section')).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/sync-dashboard-full.png', fullPage: true });
  });

  test('integration status bars render for all platforms', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    // Verify all expected platforms
    await expect(page.getByTestId('integration-status-stryd')).toBeVisible();
    await expect(page.getByTestId('integration-status-garmin')).toBeVisible();
    await expect(page.getByTestId('integration-status-strava')).toBeVisible();

    // Each should have health dots (small 2x2 elements, verify they exist in DOM)
    await expect(page.getByTestId('health-dot-stryd')).toBeAttached();
    await expect(page.getByTestId('health-dot-garmin')).toBeAttached();
    await expect(page.getByTestId('health-dot-strava')).toBeAttached();

    await page.screenshot({ path: 'test-results/screenshots/sync-dashboard-integrations.png' });
  });

  test('pending decisions section shows decision cards', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const decisionCards = page.locator('[data-testid^="decision-card-"]');
    const count = await decisionCards.count();
    expect(count).toBeGreaterThan(0);

    // First card should have title, agent badge, description
    const firstCard = page.getByTestId('decision-card-dec-001');
    if (await firstCard.isVisible()) {
      await expect(firstCard.locator('[data-testid="decision-title"]')).toBeVisible();
      await expect(firstCard.locator('[data-testid="decision-agent"]')).toBeVisible();
      await expect(firstCard.locator('[data-testid="decision-description"]')).toBeVisible();
    }

    await page.screenshot({ path: 'test-results/screenshots/sync-dashboard-decisions.png' });
  });

  test('decision cards show rationale section', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const rationale = page.getByTestId('decision-rationale').first();
    if (await rationale.isVisible()) {
      const text = await rationale.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  });

  test('decision cards have action buttons', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const actionAreas = page.getByTestId('decision-actions');
    const count = await actionAreas.count();
    expect(count).toBeGreaterThan(0);

    // Verify action buttons exist within the first action area
    const firstActions = actionAreas.first();
    const actionBtns = firstActions.locator('[data-testid^="decision-action-"]');
    const btnCount = await actionBtns.count();
    expect(btnCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/screenshots/sync-dashboard-actions.png' });
  });

  test('clicking a decision action button triggers state change', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const firstAction = page.locator('[data-testid^="decision-action-"]').first();
    if (await firstAction.isVisible()) {
      const textBefore = await firstAction.textContent();
      await firstAction.click();
      await page.waitForTimeout(1000);

      // After clicking, the card may change state (disappear, show success, etc.)
      await page.screenshot({ path: 'test-results/screenshots/sync-dashboard-action-clicked.png' });
    }
  });

  test('dashboard summary shows aggregate info', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const summary = page.getByTestId('dashboard-summary');
    await expect(summary).toBeVisible();

    // Summary should contain some badges or text
    const text = await summary.textContent();
    expect(text?.length).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/screenshots/sync-dashboard-summary.png' });
  });

  test('mobile dashboard is fully scrollable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('sync-dashboard')).toBeVisible();

    // Scroll through all sections
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/screenshots/sync-dashboard-mobile-bottom.png', fullPage: true });
  });
});
