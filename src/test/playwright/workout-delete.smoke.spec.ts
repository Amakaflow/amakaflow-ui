/**
 * Workout Delete Smoke Tests (AMA-647)
 *
 * These tests verify the critical path for workout delete functionality.
 * Run on every PR to catch regressions early.
 *
 * Tests work against real demo data — no API mocks.
 * Workout IDs are discovered dynamically from the rendered DOM.
 *
 * Tags: @smoke
 *
 * Usage:
 *   npx playwright test --project=smoke
 *   npx playwright test workout-delete.smoke.spec.ts
 */

import { test, expect } from '@playwright/test';
import { WorkoutsPage } from './pages/WorkoutsPage';

test.describe('Workout Delete Smoke Tests @smoke', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);
  });

  test('SMOKE-1: delete button opens confirmation dialog', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length, 'Need at least one workout in demo data').toBeGreaterThan(0);

    const workoutId = ids[0];
    await workoutsPage.clickDeleteButton(workoutId);

    await workoutsPage.waitForDeleteDialog();

    await expect(workoutsPage.deleteDialogTitle).toHaveText('Delete Workout');
    await expect(workoutsPage.deleteDialogDescription).toContainText('cannot be undone');
    await expect(workoutsPage.deleteDialogCancel).toBeVisible();
    await expect(workoutsPage.deleteDialogConfirm).toBeVisible();
  });

  test('SMOKE-2: cancel button closes dialog without deleting', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length).toBeGreaterThan(0);

    const initialCount = await workoutsPage.getWorkoutCount();

    await workoutsPage.clickDeleteButton(ids[0]);
    await workoutsPage.waitForDeleteDialog();

    await workoutsPage.cancelDelete();
    await workoutsPage.waitForDeleteDialogClose();

    const finalCount = await workoutsPage.getWorkoutCount();
    expect(finalCount).toBe(initialCount);
  });

  test('SMOKE-3: confirm delete removes workout from list', async ({ page }) => {
    // Intercept all DELETE requests and fulfill them successfully so we don't
    // permanently mutate demo Supabase data while still exercising the delete UI.
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

    const workoutId = ids[0];
    const initialCount = await workoutsPage.getWorkoutCount();

    await workoutsPage.clickDeleteButton(workoutId);
    await workoutsPage.waitForDeleteDialog();
    await workoutsPage.confirmDelete();

    await workoutsPage.waitForWorkoutDeleted(workoutId);

    const finalCount = await workoutsPage.getWorkoutCount();
    expect(finalCount).toBe(initialCount - 1);
  });

  test('SMOKE-4: delete button is disabled while deletion is in progress', async ({ page }) => {
    // Intercept DELETE requests with a delay to simulate slow network.
    await page.route('**', async (route) => {
      if (route.request().method() === 'DELETE') {
        await new Promise(resolve => setTimeout(resolve, 1500));
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

    const workoutId = ids[0];
    await workoutsPage.clickDeleteButton(workoutId);
    await workoutsPage.waitForDeleteDialog();

    // Confirm — triggers the slow delete
    await workoutsPage.confirmDelete();

    // Wait for the operation to complete (up to 10 s)
    await workoutsPage.waitForWorkoutDeleted(workoutId, 10_000);
  });
});
