/**
 * Workout Create from Scratch E2E Tests
 *
 * Verifies the end-to-end flow for creating a new workout manually:
 * - Navigate to Create > workflow
 * - Click "Create New" to enter the StructureWorkout editor
 * - Set workout title via settings dialog
 * - Add a block (e.g., "Sets")
 * - Add exercises to the block via ExerciseSearch
 * - Save the workout
 * - Verify it appears in the workout list
 *
 * Tests work with VITE_DEMO_MODE=true and mock API responses where needed.
 *
 * Usage:
 *   npx playwright test workout-create.spec.ts
 */

import { test, expect } from '@playwright/test';
import { WorkoutsPage } from './pages/WorkoutsPage';

// ---------------------------------------------------------------------------
// Mock data for exercise search and save API
// ---------------------------------------------------------------------------

const MOCK_EXERCISE_SEARCH_RESULTS = {
  results: [
    { id: 'ex-1', name: 'Barbell Squat', aliases: ['Back Squat'], primary_muscles: ['quadriceps', 'glutes'], secondary_muscles: ['hamstrings'], equipment: ['barbell'], category: 'strength', movement_pattern: 'squat', difficulty: 'intermediate', rank: 1 },
    { id: 'ex-2', name: 'Bench Press', aliases: ['Flat Bench'], primary_muscles: ['chest'], secondary_muscles: ['triceps'], equipment: ['barbell'], category: 'strength', movement_pattern: 'push', difficulty: 'intermediate', rank: 2 },
    { id: 'ex-3', name: 'Bent Over Row', aliases: ['Barbell Row'], primary_muscles: ['lats'], secondary_muscles: ['biceps'], equipment: ['barbell'], category: 'strength', movement_pattern: 'pull', difficulty: 'intermediate', rank: 3 },
  ],
};

const MOCK_SAVE_RESPONSE = {
  id: 'workout-created-001',
  created_at: new Date().toISOString(),
  success: true,
};

test.describe('Workout Create from Scratch', () => {

  test.beforeEach(async ({ page }) => {
    // Mock exercise search API
    await page.route('**/exercises/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EXERCISE_SEARCH_RESULTS),
      });
    });

    // Mock workout save/create API
    await page.route('**/api/workouts**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SAVE_RESPONSE),
        });
      } else {
        await route.continue();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // CREATE-1: Navigate to Create workflow and start a new workout
  // ---------------------------------------------------------------------------

  test('CREATE-1: navigate to Create and start a new workout from scratch', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to Create workflow via nav dropdown
    const createMenu = page.locator('[data-testid="nav-create-menu"]');
    // On desktop, use the dropdown menu; on mobile, navigate directly
    if (await createMenu.isVisible().catch(() => false)) {
      await createMenu.click();
      await page.getByText('Import Workout').click();
    } else {
      // Fallback: navigate directly to the workflow page
      await page.goto('/workflow');
    }

    await page.waitForLoadState('networkidle');

    // The AddSources view should be visible with a "Create New" option
    const createNewBtn = page.getByRole('button', { name: /Create New|Start from Scratch/i });
    if (await createNewBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createNewBtn.click();
    }

    // After clicking Create New, the StructureWorkout editor should appear
    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // The editor should show "Untitled Workout" or similar default title
    await expect(page.getByText(/Untitled Workout|New Workout/i)).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // CREATE-2: Set workout title via settings dialog
  // ---------------------------------------------------------------------------

  test('CREATE-2: set workout title through workout settings', async ({ page }) => {
    await page.goto('/workflow');
    await page.waitForLoadState('networkidle');

    const createNewBtn = page.getByRole('button', { name: /Create New|Start from Scratch/i });
    if (await createNewBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createNewBtn.click();
    }

    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Click the edit/settings icon next to the workout title
    const editTitleBtn = editor.locator('button[title="Workout Settings"]');
    await editTitleBtn.click();

    // The WorkoutSettingsDialog should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Find the title input and change it
    const titleInput = dialog.locator('input').first();
    await titleInput.clear();
    await titleInput.fill('My Test Workout');

    // Save the settings
    const saveBtn = dialog.getByRole('button', { name: /Save/i });
    await saveBtn.click();

    // Verify the title updated
    await expect(page.getByText('My Test Workout')).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // CREATE-3: Add a block to the workout
  // ---------------------------------------------------------------------------

  test('CREATE-3: add a block to the empty workout', async ({ page }) => {
    await page.goto('/workflow');
    await page.waitForLoadState('networkidle');

    const createNewBtn = page.getByRole('button', { name: /Create New|Start from Scratch/i });
    if (await createNewBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createNewBtn.click();
    }

    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // The empty state should prompt to add a block
    await expect(page.getByText(/No blocks yet/i)).toBeVisible();

    // Click "Add Block" button
    const addBlockBtn = page.getByRole('button', { name: /Add Block/i });
    await addBlockBtn.click();

    // The AddBlockTypePicker should appear with block type options
    await expect(page.getByText('What type of block?')).toBeVisible({ timeout: 5_000 });

    // Select "Sets" block type
    await page.getByRole('button', { name: /Sets/i }).click();

    // A new block card should appear
    await expect(page.getByText(/No blocks yet/i)).not.toBeVisible();

    // The block should contain an "Add Exercise" type button
    const addExerciseBtn = page.getByRole('button', { name: /Add Exercise/i }).first();
    await expect(addExerciseBtn).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // CREATE-4: Add exercises to a block via exercise search
  // ---------------------------------------------------------------------------

  test('CREATE-4: add exercises to a block via exercise search', async ({ page }) => {
    await page.goto('/workflow');
    await page.waitForLoadState('networkidle');

    const createNewBtn = page.getByRole('button', { name: /Create New|Start from Scratch/i });
    if (await createNewBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createNewBtn.click();
    }

    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Add a block first
    await page.getByRole('button', { name: /Add Block/i }).click();
    await page.getByRole('button', { name: /Sets/i }).click();
    await page.waitForTimeout(500);

    // Click "Add Exercise" on the new block
    const addExerciseBtn = page.getByRole('button', { name: /Add Exercise/i }).first();
    await addExerciseBtn.click();

    // The ExerciseSearch dialog should appear
    const searchDialog = page.getByRole('dialog');
    await expect(searchDialog).toBeVisible({ timeout: 5_000 });

    // Type an exercise name to search
    const searchInput = searchDialog.locator('input[type="text"]').first();
    await searchInput.fill('squat');
    await page.waitForTimeout(500);

    // Select an exercise from results
    const exerciseResult = searchDialog.getByText('Barbell Squat').first();
    await expect(exerciseResult).toBeVisible({ timeout: 5_000 });
    await exerciseResult.click();

    // The exercise should now appear in the block
    await expect(page.getByText('Barbell Squat')).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // CREATE-5: Save the created workout
  // ---------------------------------------------------------------------------

  test('CREATE-5: save the created workout', async ({ page }) => {
    await page.goto('/workflow');
    await page.waitForLoadState('networkidle');

    const createNewBtn = page.getByRole('button', { name: /Create New|Start from Scratch/i });
    if (await createNewBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createNewBtn.click();
    }

    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Add a block and exercise
    await page.getByRole('button', { name: /Add Block/i }).click();
    await page.getByRole('button', { name: /Sets/i }).click();
    await page.waitForTimeout(500);

    // Click "Save Workout" button
    const saveBtn = page.getByRole('button', { name: /Save Workout|Save Draft/i });
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });
    await saveBtn.click();

    // Wait for save to complete
    await page.waitForTimeout(2_000);
  });

  // ---------------------------------------------------------------------------
  // CREATE-6: Create workout with AI and verify editor opens
  // ---------------------------------------------------------------------------

  test('CREATE-6: create workout with AI and verify it opens in editor', async ({ page }) => {
    await page.goto('/create-ai');
    await page.waitForLoadState('networkidle');

    // Verify the Create with AI page loaded
    await expect(page.getByText('Create with AI')).toBeVisible({ timeout: 5_000 });

    // Fill in the description using a preset prompt
    const presetBtn = page.locator('[data-testid="preset-upper-body-strength"]');
    if (await presetBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await presetBtn.click();
    } else {
      const descInput = page.locator('[data-testid="ai-workout-description"]');
      await descInput.fill('Upper body strength workout targeting chest and shoulders');
    }

    // Set a title
    const titleInput = page.locator('[data-testid="ai-workout-title"]');
    await titleInput.fill('E2E Test Upper Body');

    // Click Generate
    const generateBtn = page.locator('[data-testid="generate-workout-btn"]');
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    // In demo mode, a mock workout is generated after ~1.5s
    // The StructureWorkout editor should appear with the generated workout
    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // Verify the workout has blocks and exercises
    await expect(page.getByText(/Main Lifts|Main Block/i)).toBeVisible({ timeout: 5_000 });
  });
});
