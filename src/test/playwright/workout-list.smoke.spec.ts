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
 * Tags: @smoke
 *
 * Usage:
 *   npx playwright test --project=smoke
 *   npx playwright test workout-list.smoke.spec.ts
 */

import { test, expect } from '@playwright/test';
import { WorkoutsPage } from './pages/WorkoutsPage';

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const MOCK_WORKOUTS = [
  { id: 'wl-001', title: 'Morning HIIT Workout' },
  { id: 'wl-002', title: 'Evening Strength Training' },
  { id: 'wl-003', title: 'Weekend Long Run' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Install API mocks that every test in this file needs. */
async function mockWorkoutsApi(page: import('@playwright/test').Page) {
  await page.route('**/api/workouts**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ workouts: MOCK_WORKOUTS }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('WorkoutList Smoke Tests @smoke', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);
    await mockWorkoutsApi(page);
  });

  // -------------------------------------------------------------------------
  // 1. View mode toggle
  // -------------------------------------------------------------------------

  test('WLSMOKE-1: view mode — compact is default, cards view changes layout', async ({ page }) => {
    await workoutsPage.goto('/workouts');
    await workoutsPage.waitForWorkoutsLoad();

    // Compact button should show as active (variant="default") out of the box.
    // The cards button should be "outline" (not active).
    await expect(workoutsPage.viewModeCompact).toBeVisible();
    await expect(workoutsPage.viewModeCards).toBeVisible();

    // Compact view: workout items are flat rows (space-y-1)
    const listContainer = page.locator('[data-assistant-target="library-results"]');
    await expect(listContainer).toHaveClass(/space-y-1/);

    // Switch to cards view
    await workoutsPage.switchToCardsView();

    // Cards view: workout items are cards (space-y-2)
    await expect(listContainer).toHaveClass(/space-y-2/);

    // Switch back to compact
    await workoutsPage.switchToCompactView();
    await expect(listContainer).toHaveClass(/space-y-1/);
  });

  // -------------------------------------------------------------------------
  // 2. Search filtering
  // -------------------------------------------------------------------------

  test('WLSMOKE-2: search — typing filters visible workouts', async ({ page }) => {
    await workoutsPage.goto('/workouts');
    await workoutsPage.waitForWorkoutsLoad();

    // All three workouts should be visible initially
    const initialCount = await workoutsPage.getWorkoutCount();
    expect(initialCount).toBe(MOCK_WORKOUTS.length);

    // Search for a term that matches only one workout
    await workoutsPage.search('HIIT');
    const filteredCount = await workoutsPage.getWorkoutCount();
    expect(filteredCount).toBeLessThan(initialCount);

    // The HIIT workout should still be visible
    await expect(workoutsPage.getWorkoutItem('wl-001')).toBeVisible();

    // A non-matching workout should no longer be visible
    await expect(workoutsPage.getWorkoutItem('wl-002')).not.toBeVisible();
  });

  test('WLSMOKE-3: search — term with no matches shows empty list', async ({ page }) => {
    await workoutsPage.goto('/workouts');
    await workoutsPage.waitForWorkoutsLoad();

    // Search for something that matches nothing
    await workoutsPage.search('xyzzy_no_match_ever');

    const count = await workoutsPage.getWorkoutCount();
    expect(count).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 3. Individual checkbox selection → bulk action bar appears
  // -------------------------------------------------------------------------

  test('WLSMOKE-4: selecting a workout checkbox enables the bulk-delete button', async ({ page }) => {
    await workoutsPage.goto('/workouts');
    await workoutsPage.waitForWorkoutsLoad();

    // Bulk-delete button should be disabled with nothing selected
    const bulkDeleteBtn = page.locator('[data-testid="bulk-delete-button"]');
    await expect(bulkDeleteBtn).toBeDisabled();

    // Select the first workout
    await workoutsPage.checkWorkout('wl-001');

    // Button should now be enabled
    await expect(bulkDeleteBtn).toBeEnabled();
    await expect(bulkDeleteBtn).toContainText('Delete selected (1)');
  });

  test('WLSMOKE-5: deselecting a checkbox disables the bulk-delete button again', async ({ page }) => {
    await workoutsPage.goto('/workouts');
    await workoutsPage.waitForWorkoutsLoad();

    const bulkDeleteBtn = page.locator('[data-testid="bulk-delete-button"]');

    // Select then deselect
    await workoutsPage.checkWorkout('wl-001');
    await expect(bulkDeleteBtn).toBeEnabled();

    await workoutsPage.uncheckWorkout('wl-001');
    await expect(bulkDeleteBtn).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // 4. Select-all / deselect-all
  // -------------------------------------------------------------------------

  test('WLSMOKE-6: select-all checks all workouts; clicking again deselects all', async ({ page }) => {
    await workoutsPage.goto('/workouts');
    await workoutsPage.waitForWorkoutsLoad();

    const bulkDeleteBtn = page.locator('[data-testid="bulk-delete-button"]');

    // Click select-all
    await workoutsPage.clickSelectAll();

    // All individual checkboxes should now be checked
    for (const workout of MOCK_WORKOUTS) {
      const checkbox = page.locator(`[data-testid="workout-checkbox-${workout.id}"]`);
      await expect(checkbox).toBeChecked();
    }

    // Bulk-delete button should reflect the total count
    await expect(bulkDeleteBtn).toContainText(`Delete selected (${MOCK_WORKOUTS.length})`);

    // Click select-all again to deselect
    await workoutsPage.clickSelectAll();

    // All checkboxes should be unchecked
    for (const workout of MOCK_WORKOUTS) {
      const checkbox = page.locator(`[data-testid="workout-checkbox-${workout.id}"]`);
      await expect(checkbox).not.toBeChecked();
    }

    await expect(bulkDeleteBtn).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // 5. Bulk delete flow
  // -------------------------------------------------------------------------

  test('WLSMOKE-7: bulk delete — cancel closes modal and preserves selection', async ({ page }) => {
    await workoutsPage.goto('/workouts');
    await workoutsPage.waitForWorkoutsLoad();

    // Select one workout and open the modal
    await workoutsPage.checkWorkout('wl-001');
    await workoutsPage.openBulkDeleteModal();

    // Modal should be visible
    await workoutsPage.waitForBulkDeleteModal();
    await expect(page.locator('[data-testid="bulk-delete-modal-title"]')).toContainText(
      'Delete 1 workout(s)?'
    );

    // Cancel
    await workoutsPage.cancelBulkDelete();
    await workoutsPage.waitForBulkDeleteModalClosed();

    // Selection should still be intact (checkbox remains checked)
    const checkbox = page.locator('[data-testid="workout-checkbox-wl-001"]');
    await expect(checkbox).toBeChecked();

    // Workout should still be visible
    await expect(workoutsPage.getWorkoutItem('wl-001')).toBeVisible();
  });

  test('WLSMOKE-8: bulk delete — confirm removes workouts from the list', async ({ page }) => {
    // Mock the delete API to succeed
    let deleteApiCalled = false;
    await page.route('**/api/workouts**', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteApiCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ workouts: MOCK_WORKOUTS }),
        });
      }
    });

    await workoutsPage.goto('/workouts');
    await workoutsPage.waitForWorkoutsLoad();

    const initialCount = await workoutsPage.getWorkoutCount();

    // Select one workout and open the bulk-delete modal
    await workoutsPage.checkWorkout('wl-002');
    await workoutsPage.openBulkDeleteModal();
    await workoutsPage.waitForBulkDeleteModal();

    // Confirm delete
    await workoutsPage.confirmBulkDelete();
    await workoutsPage.waitForBulkDeleteModalClosed();

    // The deleted workout should no longer be visible
    await expect(workoutsPage.getWorkoutItem('wl-002')).not.toBeVisible();

    // Overall count should have decreased
    const finalCount = await workoutsPage.getWorkoutCount();
    expect(finalCount).toBeLessThan(initialCount);
  });
});
