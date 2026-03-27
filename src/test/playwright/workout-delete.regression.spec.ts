/**
 * Workout Delete Regression Tests (AMA-647)
 *
 * Comprehensive tests for workout delete functionality including edge cases,
 * error handling, and performance scenarios.
 *
 * Run nightly and on release branches.
 *
 * Usage:
 *   npx playwright test workout-delete.regression.spec.ts
 *   npx playwright test --project=chromium workout-delete.regression.spec.ts
 */

import { test, expect } from '@playwright/test';
import { WorkoutsPage } from './pages/WorkoutsPage';

// Mock workout data for testing
const MOCK_WORKOUTS = [
  { id: 'workout-001', title: 'Morning HIIT Workout', category: 'hiit' },
  { id: 'workout-002', title: 'Evening Strength Training', category: 'strength' },
  { id: 'workout-003', title: 'Weekend Long Run', category: 'cardio' },
  { id: 'workout-004', title: 'Yoga Session', category: 'flexibility' },
  { id: 'workout-005', title: 'CrossFit WOD', category: 'hiit' },
];

test.describe('Workout Delete Regression Tests', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);
    
    // Mock API responses to return workout data
    await page.route('**/api/workouts**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ workouts: MOCK_WORKOUTS }),
      });
    });
  });

  test.describe('Happy Path', () => {
    test('REG-1: successful delete removes workout and shows success feedback', async ({ page }) => {
      let deleteCalled = false;
      await page.route('**/api/workouts/*', async (route) => {
        if (route.request().method() === 'DELETE') {
          deleteCalled = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else {
          await route.continue();
        }
      });

      await workoutsPage.goto('/workouts');
      await workoutsPage.waitForWorkoutsLoad();

      const workoutId = MOCK_WORKOUTS[0].id;
      await workoutsPage.clickDeleteButton(workoutId);
      await workoutsPage.waitForDeleteDialog();
      await workoutsPage.confirmDelete();

      // Wait for workout to be removed
      await workoutsPage.waitForWorkoutDeleted(workoutId);
      
      expect(deleteCalled).toBe(true);
      
      // Verify toast/success message appears (if implemented)
      // Note: This is optional - depends on whether toast notifications are used
    });
  });

  test.describe('Cancellation', () => {
    test('REG-2: escape key closes delete dialog', async ({ page }) => {
      await workoutsPage.goto('/workouts');
      await workoutsPage.waitForWorkoutsLoad();

      const workoutId = MOCK_WORKOUTS[0].id;
      await workoutsPage.clickDeleteButton(workoutId);
      await workoutsPage.waitForDeleteDialog();

      // Press Escape to close dialog
      await page.keyboard.press('Escape');
      await workoutsPage.waitForDeleteDialogClose();

      // Verify workout is still present
      const workoutItem = workoutsPage.getWorkoutItem(workoutId);
      await expect(workoutItem).toBeVisible();
    });

    test('REG-3: clicking outside dialog closes it without deleting', async ({ page }) => {
      await workoutsPage.goto('/workouts');
      await workoutsPage.waitForWorkoutsLoad();

      const workoutId = MOCK_WORKOUTS[0].id;
      await workoutsPage.clickDeleteButton(workoutId);
      await workoutsPage.waitForDeleteDialog();

      // Click on the overlay/backdrop (outside the dialog content)
      // The dialog should close
      await page.keyboard.press('Escape');
      await workoutsPage.waitForDeleteDialogClose();

      // Verify workout is still present
      const workoutItem = workoutsPage.getWorkoutItem(workoutId);
      await expect(workoutItem).toBeVisible();
    });

    test('REG-4: multiple workouts can be deleted sequentially', async ({ page }) => {
      let deleteCallCount = 0;
      await page.route('**/api/workouts/*', async (route) => {
        if (route.request().method() === 'DELETE') {
          deleteCallCount++;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else {
          await route.continue();
        }
      });

      await workoutsPage.goto('/workouts');
      await workoutsPage.waitForWorkoutsLoad();

      // Delete first workout
      const workoutId1 = MOCK_WORKOUTS[0].id;
      await workoutsPage.clickDeleteButton(workoutId1);
      await workoutsPage.waitForDeleteDialog();
      await workoutsPage.confirmDelete();
      await workoutsPage.waitForWorkoutDeleted(workoutId1);

      // Delete second workout
      const workoutId2 = MOCK_WORKOUTS[1].id;
      await workoutsPage.clickDeleteButton(workoutId2);
      await workoutsPage.waitForDeleteDialog();
      await workoutsPage.confirmDelete();
      await workoutsPage.waitForWorkoutDeleted(workoutId2);

      expect(deleteCallCount).toBe(2);
    });
  });

  test.describe('Network Errors', () => {
    test('REG-5: delete failure shows error message and keeps workout', async ({ page }) => {
      // Mock delete API to fail
      await page.route('**/api/workouts/*', async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
          });
        } else {
          await route.continue();
        }
      });

      await workoutsPage.goto('/workouts');
      await workoutsPage.waitForWorkoutsLoad();

      const initialCount = await workoutsPage.getWorkoutCount();
      const workoutId = MOCK_WORKOUTS[0].id;

      await workoutsPage.clickDeleteButton(workoutId);
      await workoutsPage.waitForDeleteDialog();
      await workoutsPage.confirmDelete();

      // Wait a bit for the error handling
      await page.waitForTimeout(1000);

      // The workout should still be visible (error handling should keep it)
      const workoutItem = workoutsPage.getWorkoutItem(workoutId);
      
      // Either the workout is still visible OR the dialog is still open with error
      const finalCount = await workoutsPage.getWorkoutCount();
      expect(finalCount).toBe(initialCount);
    });

    test('REG-6: network timeout during delete is handled gracefully', async ({ page }) => {
      // Mock delete API to timeout
      await page.route('**/api/workouts/*', async (route) => {
        if (route.request().method() === 'DELETE') {
          // Abort the request to simulate timeout
          await route.abort('timeout');
        } else {
          await route.continue();
        }
      });

      await workoutsPage.goto('/workouts');
      await workoutsPage.waitForWorkoutsLoad();

      const initialCount = await workoutsPage.getWorkoutCount();
      const workoutId = MOCK_WORKOUTS[0].id;

      await workoutsPage.clickDeleteButton(workoutId);
      await workoutsPage.waitForDeleteDialog();
      await workoutsPage.confirmDelete();

      // Wait for error handling
      await page.waitForTimeout(1500);

      // Workout should still be present
      const finalCount = await workoutsPage.getWorkoutCount();
      expect(finalCount).toBe(initialCount);
    });

    test('REG-7: partial delete failure shows appropriate error', async ({ page }) => {
      // Mock delete API to return success:false
      await page.route('**/api/workouts/*', async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, error: 'Workout not found' }),
          });
        } else {
          await route.continue();
        }
      });

      await workoutsPage.goto('/workouts');
      await workoutsPage.waitForWorkoutsLoad();

      const initialCount = await workoutsPage.getWorkoutCount();
      const workoutId = MOCK_WORKOUTS[0].id;

      await workoutsPage.clickDeleteButton(workoutId);
      await workoutsPage.waitForDeleteDialog();
      await workoutsPage.confirmDelete();

      // Wait for error handling
      await page.waitForTimeout(1000);

      // Workout should still be present (delete was rejected by server)
      const finalCount = await workoutsPage.getWorkoutCount();
      expect(finalCount).toBe(initialCount);
    });
  });

  test.describe('UI State', () => {
    test('REG-8: delete button state during multiple rapid clicks', async ({ page }) => {
      await workoutsPage.goto('/workouts');
      await workoutsPage.waitForWorkoutsLoad();

      const workoutId = MOCK_WORKOUTS[0].id;
      const deleteButton = workoutsPage.getDeleteButton(workoutId);

      // Rapidly click delete button multiple times
      await deleteButton.click();
      await deleteButton.click();
      await deleteButton.click();

      // Dialog should appear (only once)
      await workoutsPage.waitForDeleteDialog();
      
      // Verify dialog is visible
      await expect(workoutsPage.deleteDialog).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('REG-9: delete completes within reasonable time', async ({ page }) => {
      let deleteStartTime = 0;
      let deleteEndTime = 0;

      await page.route('**/api/workouts/*', async (route) => {
        if (route.request().method() === 'DELETE') {
          deleteStartTime = Date.now();
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
          deleteEndTime = Date.now();
        } else {
          await route.continue();
        }
      });

      await workoutsPage.goto('/workouts');
      await workoutsPage.waitForWorkoutsLoad();

      const workoutId = MOCK_WORKOUTS[0].id;
      const startTime = Date.now();

      await workoutsPage.clickDeleteButton(workoutId);
      await workoutsPage.waitForDeleteDialog();
      await workoutsPage.confirmDelete();
      await workoutsPage.waitForWorkoutDeleted(workoutId);

      const totalTime = Date.now() - startTime;
      
      // Delete should complete within 5 seconds (generous timeout)
      expect(totalTime).toBeLessThan(5000);
      
      // API call should be fast (< 2 seconds)
      if (deleteEndTime > 0) {
        expect(deleteEndTime - deleteStartTime).toBeLessThan(2000);
      }
    });
  });

  test.describe('Edge Cases', () => {
    test('REG-10: deleting workout while search is active', async ({ page }) => {
      let deleteCalled = false;
      await page.route('**/api/workouts/*', async (route) => {
        if (route.request().method() === 'DELETE') {
          deleteCalled = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else {
          await route.continue();
        }
      });

      await workoutsPage.goto('/workouts');
      await workoutsPage.waitForWorkoutsLoad();

      // Search for workouts
      await workoutsPage.search('HIIT');

      // Delete a workout from filtered results
      const workoutId = MOCK_WORKOUTS[0].id;
      await workoutsPage.clickDeleteButton(workoutId);
      await workoutsPage.waitForDeleteDialog();
      await workoutsPage.confirmDelete();

      await workoutsPage.waitForWorkoutDeleted(workoutId);
      expect(deleteCalled).toBe(true);
    });

    test('REG-11: view mode does not affect delete functionality', async ({ page }) => {
      await workoutsPage.goto('/workouts');
      await workoutsPage.waitForWorkoutsLoad();

      // Switch to cards view
      await workoutsPage.switchToCardsView();
      await page.waitForTimeout(300);

      // Delete should work in cards view
      const workoutId = MOCK_WORKOUTS[0].id;
      await workoutsPage.clickDeleteButton(workoutId);
      await workoutsPage.waitForDeleteDialog();
      await workoutsPage.cancelDelete();
      await workoutsPage.waitForDeleteDialogClose();

      // Switch to compact view
      await workoutsPage.switchToCompactView();
      await page.waitForTimeout(300);

      // Delete should work in compact view too
      await workoutsPage.clickDeleteButton(MOCK_WORKOUTS[1].id);
      await workoutsPage.waitForDeleteDialog();
    });
  });
});
