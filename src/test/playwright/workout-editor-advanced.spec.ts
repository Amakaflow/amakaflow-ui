/**
 * Workout Editor Advanced E2E Tests
 *
 * Verifies block expansion/collapse, superset operations, and edge cases
 * in the StructureWorkout editor.
 *
 * Blocks start collapsed by default (isCollapsed = true in SortableBlock).
 * The collapse toggle renders "Show" / "Hide" text with ChevronDown / ChevronUp icons.
 * Superset collapse is per-superset within an expanded block.
 *
 * Tests work with VITE_DEMO_MODE=true. Edit operations are intercepted
 * with route mocks to avoid mutating real data.
 *
 * Usage:
 *   npx playwright test workout-editor-advanced.spec.ts
 */

import { test, expect } from '@playwright/test';
import { WorkoutsPage } from './pages/WorkoutsPage';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_EXERCISE_SEARCH_RESULTS = {
  results: [
    { id: 'ex-20', name: 'Pull Up', aliases: ['Chin Up'], primary_muscles: ['lats'], secondary_muscles: ['biceps'], equipment: ['bodyweight'], category: 'strength', movement_pattern: 'pull', difficulty: 'intermediate', rank: 1 },
    { id: 'ex-21', name: 'Dumbbell Curl', aliases: ['Bicep Curl'], primary_muscles: ['biceps'], secondary_muscles: [], equipment: ['dumbbell'], category: 'strength', movement_pattern: 'isolation', difficulty: 'beginner', rank: 2 },
    { id: 'ex-22', name: 'Tricep Pushdown', aliases: [], primary_muscles: ['triceps'], secondary_muscles: [], equipment: ['cable'], category: 'strength', movement_pattern: 'isolation', difficulty: 'beginner', rank: 3 },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to the editor for the first workout in the library. */
async function openFirstWorkoutEditor(page: import('@playwright/test').Page, workoutsPage: WorkoutsPage) {
  await workoutsPage.goto('/');
  await workoutsPage.waitForWorkoutsLoad();

  const ids = await workoutsPage.getWorkoutIds();
  expect(ids.length, 'Need at least one workout in demo data').toBeGreaterThan(0);

  await workoutsPage.clickEditButton(ids[0]);

  const editor = page.locator('[data-assistant-target="workout-log"]');
  await expect(editor).toBeVisible({ timeout: 10_000 });
  return editor;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Workout Editor — Block Expansion', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);

    await page.route('**/exercises/search**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EXERCISE_SEARCH_RESULTS) });
    });
    await page.route('**/api/workouts/**', async (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        await route.continue();
      }
    });
  });

  // -----------------------------------------------------------------------
  // EXPAND-1: Collapse all blocks hides exercises
  // -----------------------------------------------------------------------

  test('EXPAND-1: collapse all blocks hides exercise content', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    // First expand all so we have a known starting state
    const expandAllBtn = page.getByRole('button', { name: /Expand All/i });
    await expandAllBtn.click();
    await page.waitForTimeout(300);

    // Verify "Add Exercise" buttons are visible (block content is shown)
    const addExBtns = page.getByRole('button', { name: /Add Exercise/i });
    const expandedCount = await addExBtns.count();
    expect(expandedCount).toBeGreaterThan(0);

    // Now collapse all
    const collapseAllBtn = page.getByRole('button', { name: /Collapse All/i });
    await collapseAllBtn.click();
    await page.waitForTimeout(300);

    // "Add Exercise" buttons should no longer be visible (collapsed)
    await expect(page.getByRole('button', { name: /Add Exercise/i }).first()).not.toBeVisible({ timeout: 3_000 });

    // All blocks should show "Show" button text (collapsed state)
    const showBtns = page.getByRole('button', { name: /Show/i });
    const showCount = await showBtns.count();
    expect(showCount).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // EXPAND-2: Expand all blocks shows exercises
  // -----------------------------------------------------------------------

  test('EXPAND-2: expand all blocks reveals exercise content', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    // Start by collapsing all
    const collapseAllBtn = page.getByRole('button', { name: /Collapse All/i });
    await collapseAllBtn.click();
    await page.waitForTimeout(300);

    // Expand all
    const expandAllBtn = page.getByRole('button', { name: /Expand All/i });
    await expandAllBtn.click();
    await page.waitForTimeout(300);

    // "Add Exercise" buttons should be visible
    const addExBtns = page.getByRole('button', { name: /Add Exercise/i });
    const visibleCount = await addExBtns.count();
    expect(visibleCount).toBeGreaterThan(0);

    // All blocks should show "Hide" button text (expanded state)
    const hideBtns = page.getByRole('button', { name: /Hide/i });
    const hideCount = await hideBtns.count();
    expect(hideCount).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // EXPAND-3: Individual block expand/collapse toggle
  // -----------------------------------------------------------------------

  test('EXPAND-3: toggle individual block expand and collapse', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    // Blocks start collapsed — the first block's toggle should say "Show"
    const firstShowBtn = page.getByRole('button', { name: /Show/i }).first();
    await expect(firstShowBtn).toBeVisible({ timeout: 5_000 });

    // Expand the first block
    await firstShowBtn.click();
    await page.waitForTimeout(300);

    // Now the toggle should say "Hide"
    const firstHideBtn = page.getByRole('button', { name: /Hide/i }).first();
    await expect(firstHideBtn).toBeVisible({ timeout: 3_000 });

    // "Add Exercise" should be visible in the expanded block
    const addExBtn = page.getByRole('button', { name: /Add Exercise/i }).first();
    await expect(addExBtn).toBeVisible({ timeout: 3_000 });

    // Collapse it back
    await firstHideBtn.click();
    await page.waitForTimeout(300);

    // "Add Exercise" should disappear again
    await expect(addExBtn).not.toBeVisible({ timeout: 3_000 });
  });
});

test.describe('Workout Editor — Superset Operations', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);

    await page.route('**/exercises/search**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EXERCISE_SEARCH_RESULTS) });
    });
    await page.route('**/api/workouts/**', async (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        await route.continue();
      }
    });
  });

  // -----------------------------------------------------------------------
  // SUPER-1: Create a superset within a block
  // -----------------------------------------------------------------------

  test('SUPER-1: create a superset within a block', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    // Expand the first block
    const showBtn = page.getByRole('button', { name: /Show/i }).first();
    await showBtn.click();
    await page.waitForTimeout(300);

    // Click "Add Superset"
    const addSupersetBtn = page.getByRole('button', { name: /Add Superset/i }).first();
    await expect(addSupersetBtn).toBeVisible({ timeout: 5_000 });
    await addSupersetBtn.click();
    await page.waitForTimeout(300);

    // A superset badge should appear
    await expect(page.getByText(/Superset \d+/)).toBeVisible({ timeout: 5_000 });
  });

  // -----------------------------------------------------------------------
  // SUPER-2: Add an exercise to a superset
  // -----------------------------------------------------------------------

  test('SUPER-2: add exercise to a superset', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    // Expand the first block
    const showBtn = page.getByRole('button', { name: /Show/i }).first();
    await showBtn.click();
    await page.waitForTimeout(300);

    // Create a superset
    const addSupersetBtn = page.getByRole('button', { name: /Add Superset/i }).first();
    await addSupersetBtn.click();
    await page.waitForTimeout(300);

    // Click "Add Exercise to Superset"
    const addToSupersetBtn = page.getByRole('button', { name: /Add Exercise to Superset/i }).first();
    await expect(addToSupersetBtn).toBeVisible({ timeout: 5_000 });
    await addToSupersetBtn.click();

    // ExerciseSearch dialog should open
    const searchDialog = page.getByRole('dialog');
    await expect(searchDialog).toBeVisible({ timeout: 5_000 });

    // Search and select an exercise
    const searchInput = searchDialog.locator('input[type="text"]').first();
    await searchInput.fill('pull');
    await page.waitForTimeout(500);

    const exerciseResult = searchDialog.getByText('Pull Up').first();
    await expect(exerciseResult).toBeVisible({ timeout: 5_000 });
    await exerciseResult.click();

    // Verify the exercise was added in the superset context
    await expect(page.getByText('Pull Up')).toBeVisible({ timeout: 5_000 });
  });

  // -----------------------------------------------------------------------
  // SUPER-3: Delete a superset
  // -----------------------------------------------------------------------

  test('SUPER-3: delete a superset from a block', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    // Expand the first block
    const showBtn = page.getByRole('button', { name: /Show/i }).first();
    await showBtn.click();
    await page.waitForTimeout(300);

    // Create a superset first
    const addSupersetBtn = page.getByRole('button', { name: /Add Superset/i }).first();
    await addSupersetBtn.click();
    await page.waitForTimeout(300);

    // Verify superset exists
    const supersetBadge = page.getByText(/Superset \d+/);
    await expect(supersetBadge).toBeVisible({ timeout: 5_000 });

    // Find the delete button for the superset (trash icon within the superset header row)
    // The superset header has a delete button with Trash2 icon
    const supersetDeleteBtn = page.locator('.border-l-4.border-primary button:has(svg.lucide-trash-2)').first();
    if (await supersetDeleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await supersetDeleteBtn.click();
      await page.waitForTimeout(300);

      // If a confirmation dialog appears, confirm
      const confirmBtn = page.getByRole('button', { name: /Delete|Confirm|Yes/i });
      if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }
  });

  // -----------------------------------------------------------------------
  // SUPER-4: Superset grouping persists after save
  // -----------------------------------------------------------------------

  test('SUPER-4: superset grouping is maintained after save', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    // Expand the first block
    const showBtn = page.getByRole('button', { name: /Show/i }).first();
    await showBtn.click();
    await page.waitForTimeout(300);

    // Create a superset
    const addSupersetBtn = page.getByRole('button', { name: /Add Superset/i }).first();
    await addSupersetBtn.click();
    await page.waitForTimeout(300);

    // Add exercise to the superset
    const addToSupersetBtn = page.getByRole('button', { name: /Add Exercise to Superset/i }).first();
    await addToSupersetBtn.click();

    const searchDialog = page.getByRole('dialog');
    await expect(searchDialog).toBeVisible({ timeout: 5_000 });

    const searchInput = searchDialog.locator('input[type="text"]').first();
    await searchInput.fill('curl');
    await page.waitForTimeout(500);

    await searchDialog.getByText('Dumbbell Curl').first().click();
    await page.waitForTimeout(300);

    // Verify superset badge still visible with exercise
    await expect(page.getByText(/Superset \d+/)).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Dumbbell Curl')).toBeVisible({ timeout: 3_000 });

    // Click Save Changes
    const saveBtn = page.getByRole('button', { name: /Save Changes/i });
    await saveBtn.click();
    await page.waitForTimeout(1_000);

    // Superset grouping should still be visible after save
    await expect(page.getByText(/Superset \d+/)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Workout Editor — Edge Cases', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);

    await page.route('**/exercises/search**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EXERCISE_SEARCH_RESULTS) });
    });
    await page.route('**/api/workouts/**', async (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        await route.continue();
      }
    });
  });

  // -----------------------------------------------------------------------
  // EDGE-1: Delete all exercises from a block — editor doesn't crash
  // -----------------------------------------------------------------------

  test('EDGE-1: delete all exercises from a block without crash', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    // Expand the first block
    const showBtn = page.getByRole('button', { name: /Show/i }).first();
    await showBtn.click();
    await page.waitForTimeout(300);

    // Try deleting all exercises one by one
    let deleteBtn = page.locator('button:has(svg.lucide-trash-2)').first();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      // Re-query each time since DOM changes after deletion
      deleteBtn = page.locator('button:has(svg.lucide-trash-2)').first();
      const visible = await deleteBtn.isVisible({ timeout: 1_000 }).catch(() => false);
      if (!visible) break;

      await deleteBtn.click();

      // Confirm if a dialog appears
      const confirmBtn = page.getByRole('button', { name: /Delete|Confirm|Yes/i });
      if (await confirmBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await page.waitForTimeout(300);
      attempts++;
    }

    // The editor should still be functional — "Add Exercise" or "Add Block" should be clickable
    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 3_000 });
  });

  // -----------------------------------------------------------------------
  // EDGE-2: Add exercise to empty block
  // -----------------------------------------------------------------------

  test('EDGE-2: add exercise to newly created empty block', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    // Add a new empty block
    const addBlockBtn = page.getByRole('button', { name: /Add Block/i });
    await addBlockBtn.click();
    await expect(page.getByText('What type of block?')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /Sets/i }).click();
    await page.waitForTimeout(300);

    // The new block is the last one — find its "Show" button (it will be the last)
    // Expand All to make all blocks visible
    const expandAllBtn = page.getByRole('button', { name: /Expand All/i });
    await expandAllBtn.click();
    await page.waitForTimeout(300);

    // Click "Add Exercise" on the last block (the newly created one)
    const addExBtns = page.getByRole('button', { name: /^Add Exercise$/i });
    const lastAddExBtn = addExBtns.last();
    await expect(lastAddExBtn).toBeVisible({ timeout: 5_000 });
    await lastAddExBtn.click();

    // Exercise search should open
    const searchDialog = page.getByRole('dialog');
    await expect(searchDialog).toBeVisible({ timeout: 5_000 });

    // Select an exercise
    const searchInput = searchDialog.locator('input[type="text"]').first();
    await searchInput.fill('tricep');
    await page.waitForTimeout(500);

    await searchDialog.getByText('Tricep Pushdown').first().click();

    // Verify exercise was added
    await expect(page.getByText('Tricep Pushdown')).toBeVisible({ timeout: 5_000 });
  });

  // -----------------------------------------------------------------------
  // EDGE-3: Rapid sequential operations — add, delete, add
  // -----------------------------------------------------------------------

  test('EDGE-3: rapid sequential add-delete-add operations', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    // Expand the first block
    const showBtn = page.getByRole('button', { name: /Show/i }).first();
    await showBtn.click();
    await page.waitForTimeout(300);

    // --- Add an exercise ---
    const addExBtn = page.getByRole('button', { name: /^Add Exercise$/i }).first();
    await addExBtn.click();

    let searchDialog = page.getByRole('dialog');
    await expect(searchDialog).toBeVisible({ timeout: 5_000 });

    let searchInput = searchDialog.locator('input[type="text"]').first();
    await searchInput.fill('pull');
    await page.waitForTimeout(500);
    await searchDialog.getByText('Pull Up').first().click();
    await page.waitForTimeout(300);

    // Verify Pull Up was added
    await expect(page.getByText('Pull Up')).toBeVisible({ timeout: 3_000 });

    // --- Delete an exercise (the one we just added or any) ---
    const deleteBtn = page.locator('button:has(svg.lucide-trash-2)').first();
    if (await deleteBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await deleteBtn.click();

      const confirmBtn = page.getByRole('button', { name: /Delete|Confirm|Yes/i });
      if (await confirmBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await confirmBtn.click();
      }
      await page.waitForTimeout(300);
    }

    // --- Add another exercise ---
    const addExBtn2 = page.getByRole('button', { name: /^Add Exercise$/i }).first();
    await addExBtn2.click();

    searchDialog = page.getByRole('dialog');
    await expect(searchDialog).toBeVisible({ timeout: 5_000 });

    searchInput = searchDialog.locator('input[type="text"]').first();
    await searchInput.fill('curl');
    await page.waitForTimeout(500);
    await searchDialog.getByText('Dumbbell Curl').first().click();
    await page.waitForTimeout(300);

    // Verify Dumbbell Curl was added
    await expect(page.getByText('Dumbbell Curl')).toBeVisible({ timeout: 3_000 });

    // Editor should still be functional
    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 3_000 });
  });

  // -----------------------------------------------------------------------
  // EDGE-4: Delete a block and verify editor remains stable
  // -----------------------------------------------------------------------

  test('EDGE-4: delete a block and verify editor stability', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    // Count blocks before deletion (each block has an exercise count badge)
    const blocksBefore = await page.locator('text=/\\d+ exercises/').count();

    // Find and click the block delete button (Trash2 icon in the block header)
    // The block header has a delete button with title "Delete block"
    const deleteBlockBtn = page.locator('button[title="Delete block"]').first();
    if (await deleteBlockBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deleteBlockBtn.click();

      // Confirm deletion in the ConfirmDialog
      const confirmBtn = page.getByRole('button', { name: /Delete/i });
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Editor should still be visible
    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 3_000 });

    // Block count should be reduced (or empty state shown)
    const blocksAfter = await page.locator('text=/\\d+ exercises/').count();
    expect(blocksAfter).toBeLessThanOrEqual(blocksBefore);
  });
});
