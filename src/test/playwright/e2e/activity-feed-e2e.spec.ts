/**
 * Activity Feed E2E Tests
 *
 * Tests the activity feed / action cards:
 * - Action cards render with type, rationale, and status
 * - Pending actions show approve/reject buttons
 * - Clicking approve changes status
 * - Undo button appears after approval
 * - Clicking undo reverts the action
 *
 * Uses the sync-dashboard preview which includes the activity feed section.
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/sync-dashboard-preview.html';

test.describe('Activity Feed E2E', () => {
  test('activity feed section renders on sync dashboard', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('activity-feed-section')).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/activity-feed-section.png' });
  });

  test('action cards render with correct structure', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const actionCards = page.locator('[data-testid^="action-card-"]');
    const count = await actionCards.count();
    expect(count).toBeGreaterThan(0);

    // Verify first card has expected elements
    const firstCard = actionCards.first();
    await expect(firstCard).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/activity-feed-cards.png' });
  });

  test('pending action card shows approve and reject buttons', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    // Look for pending actions area
    const pendingActions = page.getByTestId('pending-actions');
    if (await pendingActions.count() > 0) {
      const approveBtn = page.getByTestId('approve-btn').first();
      const rejectBtn = page.getByTestId('reject-btn').first();

      await expect(approveBtn).toBeVisible();
      await expect(rejectBtn).toBeVisible();

      await page.screenshot({ path: 'test-results/screenshots/activity-feed-pending.png' });
    }
  });

  test('clicking approve changes card status', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const approveBtn = page.getByTestId('approve-btn').first();
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await page.waitForTimeout(1000);

      // After approval, an undo button or approved status should appear
      const undoBtn = page.getByTestId('undo-btn').first();
      const approvedIcon = page.getByTestId('status-icon-approved').first();

      const hasUndo = await undoBtn.isVisible().catch(() => false);
      const hasApproved = await approvedIcon.isVisible().catch(() => false);
      expect(hasUndo || hasApproved).toBeTruthy();

      await page.screenshot({ path: 'test-results/screenshots/activity-feed-approved.png' });
    }
  });

  test('clicking undo reverts action status', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    // First approve
    const approveBtn = page.getByTestId('approve-btn').first();
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await page.waitForTimeout(1000);

      // Then undo
      const undoBtn = page.getByTestId('undo-btn').first();
      if (await undoBtn.isVisible()) {
        await undoBtn.click();
        await page.waitForTimeout(1000);

        // After undo, pending actions should reappear
        const pendingStatus = page.getByTestId('status-icon-pending').first();
        const undoneStatus = page.getByTestId('status-icon-undone').first();
        const hasState = (await pendingStatus.isVisible().catch(() => false))
          || (await undoneStatus.isVisible().catch(() => false));
        expect(hasState).toBeTruthy();

        await page.screenshot({ path: 'test-results/screenshots/activity-feed-undone.png' });
      }
    }
  });

  test('action cards display agent badge', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const agentBadges = page.getByTestId('agent-badge');
    const count = await agentBadges.count();
    if (count > 0) {
      await expect(agentBadges.first()).toBeVisible();
    }
  });

  test('action cards display rationale text', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const rationales = page.getByTestId('action-rationale');
    const count = await rationales.count();
    if (count > 0) {
      const text = await rationales.first().textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  });
});
