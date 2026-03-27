/**
 * WorkoutList Smoke Tests (AMA-867)
 *
 * Covers the core WorkoutList UI flows:
 *   - View mode toggle (compact ↔ cards)
 *   - Search/filter input
 *   - Individual checkbox selection
 *   - Select-all / deselect-all
 *   - Bulk delete: cancel and confirm paths
 *
 * Tests work against real demo data — no API mocks.
 * Workout IDs are discovered dynamically from the rendered DOM.
 *
 * Tags: @smoke
 *
 * Usage:
 *   npx playwright test --project=smoke
 *   npx playwright test workout-list.smoke.spec.ts
 */

import { test, expect } from '@playwright/test';
import { WorkoutsPage } from './pages/WorkoutsPage';

test.describe('WorkoutList Smoke Tests @smoke', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);
  });

  // -------------------------------------------------------------------------
  // 1. View mode toggle
  // -------------------------------------------------------------------------

  test('WLSMOKE-1: view mode — compact is default, cards view changes layout', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    await expect(workoutsPage.viewModeCompact).toBeVisible();
    await expect(workoutsPage.viewModeCards).toBeVisible();

    const listContainer = page.locator('[data-assistant-target="library-results"]');

    // Compact view: list has space-y-1 class
    await expect(listContainer).toHaveClass(/space-y-1/);

    // Switch to cards view
    await workoutsPage.switchToCardsView();
    await expect(listContainer).toHaveClass(/space-y-2/);

    // Switch back to compact
    await workoutsPage.switchToCompactView();
    await expect(listContainer).toHaveClass(/space-y-1/);
  });

  // -------------------------------------------------------------------------
  // 2. Search filtering
  // -------------------------------------------------------------------------

  test('WLSMOKE-2: search — typing filters visible workouts', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const initialCount = await workoutsPage.getWorkoutCount();
    expect(initialCount, 'Demo should have at least one workout').toBeGreaterThan(0);

    // Search for something that won't match any workout
    await workoutsPage.search('xyzzy_no_match_12345');
    const filteredCount = await workoutsPage.getWorkoutCount();
    expect(filteredCount).toBeLessThan(initialCount);

    // Clear search — all workouts should return
    await workoutsPage.search('');
    await page.waitForTimeout(400); // allow debounce to settle
    const restoredCount = await workoutsPage.getWorkoutCount();
    expect(restoredCount).toBe(initialCount);
  });

  test('WLSMOKE-3: search — term with no matches shows empty list', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    await workoutsPage.search('xyzzy_no_match_ever');

    const count = await workoutsPage.getWorkoutCount();
    expect(count).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 3. Individual checkbox selection → bulk action bar appears
  // -------------------------------------------------------------------------

  test('WLSMOKE-4: selecting a workout checkbox enables the bulk-delete button', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length, 'Need at least one workout in demo data').toBeGreaterThan(0);

    const bulkDeleteBtn = page.locator('[data-testid="bulk-delete-button"]');
    await expect(bulkDeleteBtn).toBeDisabled();

    await workoutsPage.checkWorkout(ids[0]);

    await expect(bulkDeleteBtn).toBeEnabled();
    await expect(bulkDeleteBtn).toContainText('Delete selected (1)');
  });

  test('WLSMOKE-5: deselecting a checkbox disables the bulk-delete button again', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length).toBeGreaterThan(0);

    const bulkDeleteBtn = page.locator('[data-testid="bulk-delete-button"]');

    await workoutsPage.checkWorkout(ids[0]);
    await expect(bulkDeleteBtn).toBeEnabled();

    await workoutsPage.uncheckWorkout(ids[0]);
    await expect(bulkDeleteBtn).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // 4. Select-all / deselect-all
  // -------------------------------------------------------------------------

  test('WLSMOKE-6: select-all checks all workouts; clicking again deselects all', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length).toBeGreaterThan(0);

    const bulkDeleteBtn = page.locator('[data-testid="bulk-delete-button"]');

    // Click select-all
    await workoutsPage.clickSelectAll();

    // All individual checkboxes should now be checked
    for (const id of ids) {
      await expect(page.locator(`[data-testid="workout-checkbox-${id}"]`)).toBeChecked();
    }

    // Bulk-delete button should reflect the total count
    await expect(bulkDeleteBtn).toContainText(`Delete selected (${ids.length})`);

    // Click select-all again to deselect
    await workoutsPage.clickSelectAll();

    // All checkboxes should be unchecked
    for (const id of ids) {
      await expect(page.locator(`[data-testid="workout-checkbox-${id}"]`)).not.toBeChecked();
    }

    await expect(bulkDeleteBtn).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // 5. Bulk delete flow
  // -------------------------------------------------------------------------

  test('WLSMOKE-7: bulk delete — cancel closes modal and preserves selection', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length).toBeGreaterThan(0);

    const firstId = ids[0];

    await workoutsPage.checkWorkout(firstId);
    await workoutsPage.openBulkDeleteModal();

    await workoutsPage.waitForBulkDeleteModal();
    await expect(page.locator('[data-testid="bulk-delete-modal-title"]')).toContainText(
      'Delete 1 workout(s)?'
    );

    await workoutsPage.cancelBulkDelete();
    await workoutsPage.waitForBulkDeleteModalClosed();

    // Selection should still be intact
    await expect(page.locator(`[data-testid="workout-checkbox-${firstId}"]`)).toBeChecked();
    await expect(workoutsPage.getWorkoutItem(firstId)).toBeVisible();
  });

  test('WLSMOKE-8: bulk delete — confirm removes workouts from the list', async ({ page }) => {
    // Intercept all DELETE requests so we don't permanently mutate demo data.
    await page.route('**', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length).toBeGreaterThan(0);

    const targetId = ids[0];
    const initialCount = await workoutsPage.getWorkoutCount();

    await workoutsPage.checkWorkout(targetId);
    await workoutsPage.openBulkDeleteModal();
    await workoutsPage.waitForBulkDeleteModal();

    await workoutsPage.confirmBulkDelete();
    await workoutsPage.waitForBulkDeleteModalClosed();

    await expect(workoutsPage.getWorkoutItem(targetId)).not.toBeVisible();

    const finalCount = await workoutsPage.getWorkoutCount();
    expect(finalCount).toBeLessThan(initialCount);
  });
});
