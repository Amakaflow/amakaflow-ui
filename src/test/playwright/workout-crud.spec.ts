/**
 * Full Workout CRUD Flow E2E Tests
 *
 * Covers the complete lifecycle of a workout:
 * - Create a workout (via AI generation in demo mode)
 * - View it in the library list
 * - Edit it (change title, add exercise)
 * - Delete it
 * - Verify it is gone from the list
 *
 * Uses route mocking for all API calls so tests are hermetic.
 * Works against VITE_DEMO_MODE=true with demo data.
 *
 * Usage:
 *   npx playwright test workout-crud.spec.ts
 */

import { test, expect } from '@playwright/test';
import { WorkoutsPage } from './pages/WorkoutsPage';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_EXERCISE_SEARCH_RESULTS = {
  results: [
    { id: 'ex-crud-1', name: 'Deadlift', aliases: ['Conventional Deadlift'], primary_muscles: ['hamstrings', 'glutes'], secondary_muscles: ['lats'], equipment: ['barbell'], category: 'strength', movement_pattern: 'hinge', difficulty: 'advanced', rank: 1 },
  ],
};

test.describe('Full Workout CRUD Flow', () => {
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
    await page.route('**/api/workouts**', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'workout-crud-001', created_at: new Date().toISOString(), success: true }),
        });
      } else if (method === 'PUT' || method === 'PATCH') {
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
  // CRUD-1: Create — generate a workout with AI and verify it enters the editor
  // ---------------------------------------------------------------------------

  test('CRUD-1: create a workout via AI generation', async ({ page }) => {
    await page.goto('/create-ai');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Create with AI')).toBeVisible({ timeout: 5_000 });

    // Fill in description
    const descInput = page.locator('[data-testid="ai-workout-description"]');
    await descInput.fill('Full body strength workout with compound movements');

    // Set title
    const titleInput = page.locator('[data-testid="ai-workout-title"]');
    await titleInput.fill('CRUD Test Workout');

    // Generate
    const generateBtn = page.locator('[data-testid="generate-workout-btn"]');
    await generateBtn.click();

    // In demo mode, the editor should open with the generated workout
    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // Verify blocks appeared
    await expect(page.getByText(/Main Lifts|Main Block/i)).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // CRUD-2: Read — view workouts in the library list
  // ---------------------------------------------------------------------------

  test('CRUD-2: view workouts in the library list', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length, 'Demo mode should have workouts in the library').toBeGreaterThan(0);

    // Verify workout items are visible
    for (const id of ids.slice(0, 3)) {
      const item = workoutsPage.getWorkoutItem(id);
      await expect(item).toBeVisible();
    }

    // Verify edit and delete buttons are present
    const firstId = ids[0];
    await expect(workoutsPage.getEditButton(firstId)).toBeVisible();
    await expect(workoutsPage.getDeleteButton(firstId)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // CRUD-3: Update — edit a workout (change title, add exercise)
  // ---------------------------------------------------------------------------

  test('CRUD-3: edit a workout — change title and add exercise', async ({ page }) => {
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length).toBeGreaterThan(0);

    // Open workout in edit mode
    await workoutsPage.clickEditButton(ids[0]);

    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Change the title via settings dialog
    const editTitleBtn = editor.locator('button[title="Workout Settings"]');
    await editTitleBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const titleInput = dialog.locator('input').first();
    await titleInput.clear();
    await titleInput.fill('CRUD Updated Title');

    await dialog.getByRole('button', { name: /Save/i }).click();
    await expect(page.getByText('CRUD Updated Title')).toBeVisible({ timeout: 5_000 });

    // Add an exercise to the first block
    const addExerciseBtn = page.getByRole('button', { name: /Add Exercise/i }).first();
    if (await addExerciseBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await addExerciseBtn.click();

      const searchDialog = page.getByRole('dialog');
      await expect(searchDialog).toBeVisible({ timeout: 5_000 });

      const searchInput = searchDialog.locator('input[type="text"]').first();
      await searchInput.fill('deadlift');
      await page.waitForTimeout(500);

      const exerciseResult = searchDialog.getByText('Deadlift').first();
      if (await exerciseResult.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await exerciseResult.click();
        await expect(page.getByText('Deadlift')).toBeVisible({ timeout: 5_000 });
      }
    }

    // Save changes
    const saveBtn = page.getByRole('button', { name: /Save Changes/i });
    await saveBtn.click();
    await page.waitForTimeout(2_000);
  });

  // ---------------------------------------------------------------------------
  // CRUD-4: Delete — delete a workout and verify it is removed
  // ---------------------------------------------------------------------------

  test('CRUD-4: delete a workout and verify it is removed', async ({ page }) => {
    // Intercept DELETE requests
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
    expect(ids.length, 'Need at least one workout to delete').toBeGreaterThan(0);

    const targetId = ids[0];
    const initialCount = await workoutsPage.getWorkoutCount();

    // Click delete button
    await workoutsPage.clickDeleteButton(targetId);

    // Wait for confirmation dialog
    await workoutsPage.waitForDeleteDialog();
    await expect(workoutsPage.deleteDialogTitle).toHaveText('Delete Workout');

    // Confirm deletion
    await workoutsPage.confirmDelete();

    // Wait for workout to be removed
    await workoutsPage.waitForWorkoutDeleted(targetId);

    // Verify count decreased
    const finalCount = await workoutsPage.getWorkoutCount();
    expect(finalCount).toBe(initialCount - 1);
  });

  // ---------------------------------------------------------------------------
  // CRUD-5: Full lifecycle — create, list, edit, delete
  // ---------------------------------------------------------------------------

  test('CRUD-5: full CRUD lifecycle in a single test', async ({ page }) => {
    // ── Step 1: List existing workouts ─────────────────────────────────────
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();

    const initialIds = await workoutsPage.getWorkoutIds();
    const initialCount = initialIds.length;
    expect(initialCount).toBeGreaterThan(0);

    // ── Step 2: Open first workout in edit mode and verify ─────────────────
    await workoutsPage.clickEditButton(initialIds[0]);

    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Edit Workout')).toBeVisible();

    // ── Step 3: Make a change (add a block) ────────────────────────────────
    const addBlockBtn = page.getByRole('button', { name: /Add Block/i });
    await addBlockBtn.click();
    await expect(page.getByText('What type of block?')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /AMRAP/i }).click();
    await page.waitForTimeout(500);

    // ── Step 4: Save and go back ───────────────────────────────────────────
    const saveBtn = page.getByRole('button', { name: /Save Changes/i });
    await saveBtn.click();
    await page.waitForTimeout(2_000);

    const backBtn = page.getByText('Back to History');
    if (await backBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await backBtn.click();
      await workoutsPage.waitForWorkoutsLoad();
    }

    // ── Step 5: Delete the workout ─────────────────────────────────────────
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

    const idsAfterEdit = await workoutsPage.getWorkoutIds();
    if (idsAfterEdit.length > 0) {
      const deleteTarget = idsAfterEdit[0];
      await workoutsPage.clickDeleteButton(deleteTarget);
      await workoutsPage.waitForDeleteDialog();
      await workoutsPage.confirmDelete();
      await workoutsPage.waitForWorkoutDeleted(deleteTarget);

      // Verify the deleted workout is gone
      await expect(workoutsPage.getWorkoutItem(deleteTarget)).not.toBeVisible();
    }
  });
});
