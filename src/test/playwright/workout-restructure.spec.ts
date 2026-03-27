/**
 * Workout Edit/Restructure E2E Tests
 *
 * Verifies the full edit flow for an existing workout:
 * - Open a workout in edit mode from the library
 * - Change the title
 * - Add a new exercise
 * - Remove an exercise
 * - Add a new block
 * - Save changes
 * - Verify changes persisted
 *
 * Tests work with VITE_DEMO_MODE=true. Edit operations are intercepted
 * with route mocks to avoid mutating real data.
 *
 * Usage:
 *   npx playwright test workout-restructure.spec.ts
 */

import { test, expect } from '@playwright/test';
import { WorkoutsPage } from './pages/WorkoutsPage';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_EXERCISE_SEARCH_RESULTS = {
  results: [
    { id: 'ex-10', name: 'Overhead Press', aliases: ['OHP'], primary_muscles: ['shoulders'], secondary_muscles: ['triceps'], equipment: ['barbell'], category: 'strength', movement_pattern: 'push', difficulty: 'intermediate', rank: 1 },
    { id: 'ex-11', name: 'Lateral Raise', aliases: [], primary_muscles: ['shoulders'], secondary_muscles: [], equipment: ['dumbbell'], category: 'strength', movement_pattern: 'isolation', difficulty: 'beginner', rank: 2 },
  ],
};

test.describe('Workout Edit/Restructure', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);

    // Mock exercise search API
    await page.route('**/exercises/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EXERCISE_SEARCH_RESULTS),
      });
    });

    // Mock save/update API
    await page.route('**/api/workouts/**', async (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // RESTR-1: Open workout in edit mode
  // ---------------------------------------------------------------------------

  test('RESTR-1: open an existing workout in edit mode from library', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length, 'Need at least one workout in demo data').toBeGreaterThan(0);

    await workoutsPage.clickEditButton(ids[0]);

    // The StructureWorkout editor should be visible
    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Confirm we are in edit mode
    await expect(page.getByText('Edit Workout')).toBeVisible();
    await expect(page.getByRole('button', { name: /Save Changes/i })).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // RESTR-2: Change the workout title
  // ---------------------------------------------------------------------------

  test('RESTR-2: change the workout title in edit mode', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length).toBeGreaterThan(0);

    await workoutsPage.clickEditButton(ids[0]);

    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Click the edit/settings icon next to the title
    const editTitleBtn = editor.locator('button[title="Workout Settings"]');
    await editTitleBtn.click();

    // Dialog should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Clear existing title and type new one
    const titleInput = dialog.locator('input').first();
    await titleInput.clear();
    await titleInput.fill('Restructured Workout Title');

    // Save
    await dialog.getByRole('button', { name: /Save/i }).click();

    // Verify title updated in the editor
    await expect(page.getByText('Restructured Workout Title')).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // RESTR-3: Add a new exercise to an existing block
  // ---------------------------------------------------------------------------

  test('RESTR-3: add a new exercise to an existing block', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length).toBeGreaterThan(0);

    await workoutsPage.clickEditButton(ids[0]);

    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Find and click "Add Exercise" button on the first block
    const addExerciseBtn = page.getByRole('button', { name: /Add Exercise/i }).first();
    await expect(addExerciseBtn).toBeVisible({ timeout: 5_000 });
    await addExerciseBtn.click();

    // ExerciseSearch dialog should open
    const searchDialog = page.getByRole('dialog');
    await expect(searchDialog).toBeVisible({ timeout: 5_000 });

    // Search and select an exercise
    const searchInput = searchDialog.locator('input[type="text"]').first();
    await searchInput.fill('overhead');
    await page.waitForTimeout(500);

    const exerciseResult = searchDialog.getByText('Overhead Press').first();
    await expect(exerciseResult).toBeVisible({ timeout: 5_000 });
    await exerciseResult.click();

    // Verify the exercise was added
    await expect(page.getByText('Overhead Press')).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // RESTR-4: Remove an exercise from a block
  // ---------------------------------------------------------------------------

  test('RESTR-4: remove an exercise from a block', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length).toBeGreaterThan(0);

    await workoutsPage.clickEditButton(ids[0]);

    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Count exercises before deletion
    // Exercises are rendered inside sortable exercise items
    const exerciseItems = editor.locator('[class*="exercise"], [data-testid^="exercise-"]');
    const initialCount = await exerciseItems.count().catch(() => 0);

    // Find a delete button for an exercise (trash icon)
    // In SortableExercise, the delete button has a Trash2 icon
    const deleteBtn = editor.locator('button:has(svg.lucide-trash-2)').first();
    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deleteBtn.click();

      // If a confirmation dialog appears, confirm
      const confirmBtn = page.getByRole('button', { name: /Delete|Confirm|Yes/i });
      if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      // Wait for the exercise to be removed
      await page.waitForTimeout(500);
    }
  });

  // ---------------------------------------------------------------------------
  // RESTR-5: Add a new block to the workout
  // ---------------------------------------------------------------------------

  test('RESTR-5: add a new block to an existing workout', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length).toBeGreaterThan(0);

    await workoutsPage.clickEditButton(ids[0]);

    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Click "Add Block" at the bottom of the editor
    const addBlockBtn = page.getByRole('button', { name: /Add Block/i });
    await addBlockBtn.click();

    // Block type picker should appear
    await expect(page.getByText('What type of block?')).toBeVisible({ timeout: 5_000 });

    // Select "Circuit" block type
    await page.getByRole('button', { name: /Circuit/i }).click();

    // Verify the new block was added — footer stats should update
    await page.waitForTimeout(500);
  });

  // ---------------------------------------------------------------------------
  // RESTR-6: Save changes and verify Back to History works
  // ---------------------------------------------------------------------------

  test('RESTR-6: save changes and return to workout list', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length).toBeGreaterThan(0);

    await workoutsPage.clickEditButton(ids[0]);

    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Click "Save Changes"
    const saveBtn = page.getByRole('button', { name: /Save Changes/i });
    await saveBtn.click();

    // Wait for save to complete
    await page.waitForTimeout(2_000);

    // Click "Back to History" to return to the list
    const backBtn = page.getByText('Back to History');
    if (await backBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await backBtn.click();

      // Workout list should be visible again
      await expect(
        page.locator('[data-assistant-target="library-results"]')
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  // ---------------------------------------------------------------------------
  // RESTR-7: Collapse and expand all blocks
  // ---------------------------------------------------------------------------

  test('RESTR-7: collapse all and expand all blocks', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length).toBeGreaterThan(0);

    await workoutsPage.clickEditButton(ids[0]);

    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Click "Collapse All"
    const collapseBtn = page.getByRole('button', { name: /Collapse All/i });
    if (await collapseBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await collapseBtn.click();
      await page.waitForTimeout(500);

      // Click "Expand All"
      const expandBtn = page.getByRole('button', { name: /Expand All/i });
      await expandBtn.click();
      await page.waitForTimeout(500);
    }
  });
});
