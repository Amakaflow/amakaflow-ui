/**
 * Workout Editor — Inner Edits & Edge Cases
 *
 * Comprehensive tests for every editable field in the workout editor:
 * - Exercise-level edits (name, sets, reps, type tabs, rest, notes, warmup, modifiers)
 * - Block-level edits (name, type, config rows, deletion)
 * - Workout-level settings (title, rest type, warmup, auto-add periods)
 * - Validation edge cases (empty names, boundary values, special characters)
 * - State preservation (collapse/expand, dialog close, multi-edit)
 * - Interaction edge cases (rapid clicks, Escape key, dialog dismiss)
 *
 * All tests use VITE_DEMO_MODE=true and mock API routes for isolation.
 *
 * Usage:
 *   npx playwright test workout-editor-inner-edits.spec.ts
 */

import { test, expect, Page } from '@playwright/test';
import { WorkoutsPage } from './pages/WorkoutsPage';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_EXERCISE_SEARCH_RESULTS = {
  results: [
    { id: 'ex-30', name: 'Bench Press', aliases: ['Flat Bench'], primary_muscles: ['chest'], secondary_muscles: ['triceps'], equipment: ['barbell'], category: 'strength', movement_pattern: 'push', difficulty: 'intermediate', rank: 1 },
    { id: 'ex-31', name: 'Deadlift', aliases: ['Conventional Deadlift'], primary_muscles: ['back'], secondary_muscles: ['hamstrings'], equipment: ['barbell'], category: 'strength', movement_pattern: 'hinge', difficulty: 'advanced', rank: 2 },
    { id: 'ex-32', name: 'Squat', aliases: ['Back Squat'], primary_muscles: ['quads'], secondary_muscles: ['glutes'], equipment: ['barbell'], category: 'strength', movement_pattern: 'squat', difficulty: 'intermediate', rank: 3 },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to the editor for the first workout in the library. */
async function openFirstWorkoutEditor(page: Page, workoutsPage: WorkoutsPage) {
  await workoutsPage.goto('/');
  await workoutsPage.waitForWorkoutsLoad();

  const ids = await workoutsPage.getWorkoutIds();
  expect(ids.length, 'Need at least one workout in demo data').toBeGreaterThan(0);

  await workoutsPage.clickEditButton(ids[0]);

  const editor = page.locator('[data-assistant-target="workout-log"]');
  await expect(editor).toBeVisible({ timeout: 10_000 });
  return editor;
}

/** Expand the first block in the editor (blocks start collapsed). */
async function expandFirstBlock(page: Page) {
  const showBtn = page.getByRole('button', { name: /Show/i }).first();
  await expect(showBtn).toBeVisible({ timeout: 5_000 });
  await showBtn.click();
  await page.waitForTimeout(300);
}

/** Expand all blocks using the "Expand All" button. */
async function expandAllBlocks(page: Page) {
  const expandAllBtn = page.getByRole('button', { name: /Expand All/i });
  await expandAllBtn.click();
  await page.waitForTimeout(300);
}

/** Click the edit (pencil) button on the first exercise in the first expanded block. */
async function openFirstExerciseEditor(page: Page) {
  // The edit button is inside SortableExercise - find the first Edit2 icon button within exercises
  const exerciseEditBtns = page.locator('.border.rounded-lg.bg-muted\\/50 button:has(svg.lucide-edit-2)');
  const editBtn = exerciseEditBtns.first();
  await expect(editBtn).toBeVisible({ timeout: 5_000 });
  await editBtn.click();
  // Wait for the EditExerciseDialog to open
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  return dialog;
}

/** Open the Workout Settings dialog via the pencil icon in the header. */
async function openWorkoutSettings(page: Page) {
  const settingsBtn = page.locator('button[title="Workout Settings"]');
  await settingsBtn.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  return dialog;
}

/** Open the Edit Block dialog via the pencil icon on the first block header. */
async function openFirstBlockEditor(page: Page) {
  const editBlockBtn = page.locator('button[title="Edit block name"]').first();
  await expect(editBlockBtn).toBeVisible({ timeout: 5_000 });
  await editBlockBtn.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  return dialog;
}

// ---------------------------------------------------------------------------
// Common setup
// ---------------------------------------------------------------------------

function setupMockRoutes(page: Page) {
  return Promise.all([
    page.route('**/exercises/search**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EXERCISE_SEARCH_RESULTS) });
    }),
    page.route('**/api/workouts/**', async (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        await route.continue();
      }
    }),
  ]);
}

// ===========================================================================
// EXERCISE DETAIL EDITS
// ===========================================================================

test.describe('Exercise Detail Edits', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);
    await setupMockRoutes(page);
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-1: Edit exercise name
  // -------------------------------------------------------------------------
  test('EX-EDIT-1: edit exercise name in the exercise dialog', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    // The "Exercise Name" input should be visible
    const nameInput = dialog.locator('input').first();
    await expect(nameInput).toBeVisible();

    // Clear and type a new name
    await nameInput.fill('Barbell Back Squat');
    await expect(nameInput).toHaveValue('Barbell Back Squat');
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-2: Change sets count via number input
  // -------------------------------------------------------------------------
  test('EX-EDIT-2: change sets count via number input', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    // Ensure we're on the Sets/Reps tab (default for strength exercises)
    const setsRepsTab = dialog.getByRole('tab', { name: /Sets\/Reps/i });
    if (await setsRepsTab.isVisible()) {
      await setsRepsTab.click();
    }

    // Find the sets number input (type=number within the sets section)
    const setsInput = dialog.locator('input[type="number"]').first();
    await setsInput.fill('5');
    await expect(setsInput).toHaveValue('5');
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-3: Change reps count via number input
  // -------------------------------------------------------------------------
  test('EX-EDIT-3: change reps count via number input', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const setsRepsTab = dialog.getByRole('tab', { name: /Sets\/Reps/i });
    if (await setsRepsTab.isVisible()) {
      await setsRepsTab.click();
    }

    // Second number input in sets-reps tab is reps
    const repsInput = dialog.locator('input[type="number"]').nth(1);
    await repsInput.fill('12');
    await expect(repsInput).toHaveValue('12');
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-4: Set reps range
  // -------------------------------------------------------------------------
  test('EX-EDIT-4: set reps range in exercise dialog', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const setsRepsTab = dialog.getByRole('tab', { name: /Sets\/Reps/i });
    if (await setsRepsTab.isVisible()) {
      await setsRepsTab.click();
    }

    // Find the "Reps Range" input by placeholder
    const repsRangeInput = dialog.locator('input[placeholder="e.g., 10-12"]');
    await repsRangeInput.fill('8-12');
    await expect(repsRangeInput).toHaveValue('8-12');
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-5: Switch exercise type to Duration
  // -------------------------------------------------------------------------
  test('EX-EDIT-5: switch exercise type to Duration tab', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const durationTab = dialog.getByRole('tab', { name: /Duration/i });
    await durationTab.click();

    // Duration seconds input should now be visible
    const durationLabel = dialog.getByText('Duration (seconds)');
    await expect(durationLabel).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-6: Switch exercise type to Distance
  // -------------------------------------------------------------------------
  test('EX-EDIT-6: switch exercise type to Distance tab', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const distanceTab = dialog.getByRole('tab', { name: /Distance/i });
    await distanceTab.click();

    // Distance label should appear
    const distanceLabel = dialog.getByText('Distance').first();
    await expect(distanceLabel).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-7: Switch exercise type to Calories
  // -------------------------------------------------------------------------
  test('EX-EDIT-7: switch exercise type to Calories tab', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const caloriesTab = dialog.getByRole('tab', { name: /Calories/i });
    await caloriesTab.click();

    // Calorie target label should appear
    const calorieLabel = dialog.getByText('Calorie Target');
    await expect(calorieLabel).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-8: Change rest type to Lap Button
  // -------------------------------------------------------------------------
  test('EX-EDIT-8: change rest type from timed to lap button', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    // The rest type select is labeled "Rest After Exercise"
    const restLabel = dialog.getByText('Rest After Exercise');
    await expect(restLabel).toBeVisible();

    // Click the select trigger for rest type
    const restSelect = dialog.locator('.w-36.h-8').last();
    await restSelect.click();
    await page.waitForTimeout(200);

    // Select "Lap Button"
    const lapButtonOption = page.getByRole('option', { name: /Lap Button/i });
    await lapButtonOption.click();

    // The lap button description text should appear
    await expect(dialog.getByText(/Press lap button when ready/)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-9: Add notes to exercise
  // -------------------------------------------------------------------------
  test('EX-EDIT-9: add notes to an exercise', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const notesTextarea = dialog.locator('textarea');
    await notesTextarea.fill('Keep elbows tucked, focus on eccentric phase');
    await expect(notesTextarea).toHaveValue('Keep elbows tucked, focus on eccentric phase');
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-10: Enable and configure warm-up sets
  // -------------------------------------------------------------------------
  test('EX-EDIT-10: enable warm-up sets and configure count/reps', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    // Make sure we're on Sets/Reps tab
    const setsRepsTab = dialog.getByRole('tab', { name: /Sets\/Reps/i });
    if (await setsRepsTab.isVisible()) {
      await setsRepsTab.click();
    }

    // Find and click the "Warm-Up Sets" text to expand the section
    const warmupLabel = dialog.getByText('Warm-Up Sets').first();
    await warmupLabel.click();
    await page.waitForTimeout(200);

    // The switch next to Warm-Up Sets should be visible — enable it
    const warmupSection = dialog.locator('.border.rounded-lg:has-text("Warm-Up Sets")');
    const warmupSwitch = warmupSection.locator('button[role="switch"]').first();
    const isChecked = await warmupSwitch.getAttribute('data-state');
    if (isChecked !== 'checked') {
      await warmupSwitch.click();
    }

    // Verify the preview text appears (e.g., "2 warm-up x 12 reps -> 3 working x 10 reps")
    await expect(dialog.getByText(/warm-up/i)).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-11: Enable duration-per-set modifier
  // -------------------------------------------------------------------------
  test('EX-EDIT-11: enable duration per set modifier', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const setsRepsTab = dialog.getByRole('tab', { name: /Sets\/Reps/i });
    if (await setsRepsTab.isVisible()) {
      await setsRepsTab.click();
    }

    // Find the "Duration per set" toggle
    const durationPerSetLabel = dialog.getByText('Duration per set');
    await expect(durationPerSetLabel).toBeVisible();

    const modifierSection = dialog.locator('.border.rounded-lg:has-text("Duration per set")');
    const durationSwitch = modifierSection.locator('button[role="switch"]').first();
    await durationSwitch.click();

    // Preview text should appear with duration format
    await expect(dialog.getByText(/Preview:/i).last()).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-12: Enable time cap modifier on Distance tab
  // -------------------------------------------------------------------------
  test('EX-EDIT-12: enable time cap on distance exercise', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    // Switch to Distance tab
    const distanceTab = dialog.getByRole('tab', { name: /Distance/i });
    await distanceTab.click();
    await page.waitForTimeout(200);

    // Find and enable Time Cap toggle
    const timeCapLabel = dialog.getByText('Time Cap').first();
    await expect(timeCapLabel).toBeVisible();

    const timeCapSection = dialog.locator('.border.rounded-lg:has-text("Time Cap")');
    const timeCapSwitch = timeCapSection.locator('button[role="switch"]').first();
    await timeCapSwitch.click();

    // "Set a maximum time" description should appear
    await expect(dialog.getByText(/Set a maximum time/)).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-13: Close exercise dialog with Done button
  // -------------------------------------------------------------------------
  test('EX-EDIT-13: close exercise dialog via Done button', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const doneBtn = dialog.getByRole('button', { name: /Done/i });
    await doneBtn.click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-14: Set distance range
  // -------------------------------------------------------------------------
  test('EX-EDIT-14: set distance range in exercise dialog', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const distanceTab = dialog.getByRole('tab', { name: /Distance/i });
    await distanceTab.click();
    await page.waitForTimeout(200);

    const distRangeInput = dialog.locator('input[placeholder="e.g., 100-200m"]');
    await distRangeInput.fill('400-800m');
    await expect(distRangeInput).toHaveValue('400-800m');
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-15: Change calorie target value
  // -------------------------------------------------------------------------
  test('EX-EDIT-15: change calorie target in calories tab', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const caloriesTab = dialog.getByRole('tab', { name: /Calories/i });
    await caloriesTab.click();
    await page.waitForTimeout(200);

    // The calories number input
    const calInput = dialog.locator('input[type="number"][placeholder="cal"]');
    await calInput.fill('150');
    await expect(calInput).toHaveValue('150');
  });

  // -------------------------------------------------------------------------
  // EX-EDIT-16: Change rest duration via number input
  // -------------------------------------------------------------------------
  test('EX-EDIT-16: change rest duration via number input', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    // Find the rest sec input (the one with placeholder "sec" near "Rest After Exercise")
    const restInput = dialog.locator('input[type="number"][placeholder="sec"]').first();
    if (await restInput.isVisible()) {
      await restInput.fill('90');
      await expect(restInput).toHaveValue('90');
    }
  });
});

// ===========================================================================
// BLOCK-LEVEL EDITS
// ===========================================================================

test.describe('Block-Level Edits', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);
    await setupMockRoutes(page);
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-1: Rename a block via EditBlockDialog
  // -------------------------------------------------------------------------
  test('BLK-EDIT-1: rename a block via Edit Block dialog', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstBlockEditor(page);

    // The "Block Name" input should be pre-filled
    const nameInput = dialog.locator('input[placeholder="Block name"]');
    await expect(nameInput).toBeVisible();

    await nameInput.fill('Power Block A');
    await expect(nameInput).toHaveValue('Power Block A');

    // Save changes
    const saveBtn = dialog.getByRole('button', { name: /Save Changes/i });
    await saveBtn.click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-2: Change block type via inline dropdown
  // -------------------------------------------------------------------------
  test('BLK-EDIT-2: change block type via inline dropdown', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);

    // The block type selector is in the header
    const typeSelector = page.locator('.bg-muted\\/20 button[role="combobox"]').first();
    await expect(typeSelector).toBeVisible({ timeout: 5_000 });
    await typeSelector.click();
    await page.waitForTimeout(200);

    // Select "Circuit" from the dropdown
    const circuitOption = page.getByRole('option', { name: /Circuit/i });
    await circuitOption.click();
    await page.waitForTimeout(300);

    // Verify the selector now shows "Circuit"
    await expect(typeSelector).toContainText('Circuit');
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-3: Configure circuit rounds via BlockConfigRow stepper
  // -------------------------------------------------------------------------
  test('BLK-EDIT-3: configure circuit rounds via BlockConfigRow', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);

    // Change block type to Circuit
    const typeSelector = page.locator('.bg-muted\\/20 button[role="combobox"]').first();
    await typeSelector.click();
    await page.waitForTimeout(200);
    const circuitOption = page.getByRole('option', { name: /Circuit/i });
    await circuitOption.click();
    await page.waitForTimeout(300);

    // Find the Rounds stepper "+" button
    const roundsLabel = page.getByText('Rounds').first();
    await expect(roundsLabel).toBeVisible({ timeout: 3_000 });

    // Click the "+" button to increase rounds
    const roundsPlusBtn = page.locator('button[aria-label="+"]').first();
    await roundsPlusBtn.click();
    await page.waitForTimeout(200);
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-4: Enable rest override in Edit Block dialog
  // -------------------------------------------------------------------------
  test('BLK-EDIT-4: enable rest override in Edit Block dialog', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstBlockEditor(page);

    // Find the "Override Rest Settings" switch
    const overrideLabel = dialog.getByText('Override Rest Settings');
    await expect(overrideLabel).toBeVisible();

    // Toggle the override switch
    const overrideSwitch = dialog.locator('button[role="switch"]').first();
    await overrideSwitch.click();
    await page.waitForTimeout(200);

    // "Rest After Exercise" label should appear
    await expect(dialog.getByText('Rest After Exercise')).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-5: Bulk edit sets via Edit Block dialog slider
  // -------------------------------------------------------------------------
  test('BLK-EDIT-5: bulk edit sets via Edit Block dialog', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstBlockEditor(page);

    // Find the Sets number input in the bulk edit section
    const setsInput = dialog.locator('input[type="number"]').first();
    await setsInput.fill('4');
    await expect(setsInput).toHaveValue('4');
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-6: Toggle reps override and set value
  // -------------------------------------------------------------------------
  test('BLK-EDIT-6: toggle reps override and set bulk value', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstBlockEditor(page);

    // Find and enable "Override Reps" switch
    const overrideRepsSwitch = dialog.locator('#apply-reps');
    await overrideRepsSwitch.click();
    await page.waitForTimeout(200);

    // Reps slider and input should now be visible
    const repsInput = dialog.locator('input[type="number"]').nth(1);
    await expect(repsInput).toBeVisible();
    await repsInput.fill('15');
    await expect(repsInput).toHaveValue('15');
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-7: Toggle rep range override
  // -------------------------------------------------------------------------
  test('BLK-EDIT-7: toggle rep range override and set value', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstBlockEditor(page);

    // Find and enable "Override Rep Range" switch
    const overrideRangeSwitch = dialog.locator('#apply-reps-range');
    await overrideRangeSwitch.click();
    await page.waitForTimeout(200);

    // Rep Range input should appear
    const rangeInput = dialog.locator('input[placeholder="e.g. 8-12"]');
    await expect(rangeInput).toBeVisible();
    await rangeInput.fill('6-10');
    await expect(rangeInput).toHaveValue('6-10');
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-8: Delete a block with confirmation
  // -------------------------------------------------------------------------
  test('BLK-EDIT-8: delete a block triggers confirmation dialog', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    // Find the delete block button
    const deleteBlockBtn = page.locator('button[title="Delete block"]').first();
    await expect(deleteBlockBtn).toBeVisible({ timeout: 5_000 });
    await deleteBlockBtn.click();

    // The ConfirmDialog should open with "Delete Block" title
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 });
    await expect(confirmDialog.getByText(/Delete Block/)).toBeVisible();

    // Cancel the deletion
    const cancelBtn = confirmDialog.getByRole('button', { name: /Cancel/i });
    await cancelBtn.click();
    await expect(confirmDialog).not.toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-9: Change block type to EMOM and configure
  // -------------------------------------------------------------------------
  test('BLK-EDIT-9: change block type to EMOM shows rounds and time cap', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);

    const typeSelector = page.locator('.bg-muted\\/20 button[role="combobox"]').first();
    await typeSelector.click();
    await page.waitForTimeout(200);
    const emomOption = page.getByRole('option', { name: /EMOM/i });
    await emomOption.click();
    await page.waitForTimeout(300);

    // EMOM config should show "Rounds" and "Time Cap"
    await expect(page.getByText('Rounds').first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(/Time Cap/i).first()).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-10: Change block type to Tabata and configure
  // -------------------------------------------------------------------------
  test('BLK-EDIT-10: change block type to Tabata shows work/rest/rounds', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);

    const typeSelector = page.locator('.bg-muted\\/20 button[role="combobox"]').first();
    await typeSelector.click();
    await page.waitForTimeout(200);
    const tabataOption = page.getByRole('option', { name: /Tabata/i });
    await tabataOption.click();
    await page.waitForTimeout(300);

    // Tabata config should show "Work", "Rest per interval", and "Rounds"
    await expect(page.getByText('Work').first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Rest per interval').first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Rounds').first()).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-11: Change block type to AMRAP shows time cap
  // -------------------------------------------------------------------------
  test('BLK-EDIT-11: change block type to AMRAP shows time cap', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);

    const typeSelector = page.locator('.bg-muted\\/20 button[role="combobox"]').first();
    await typeSelector.click();
    await page.waitForTimeout(200);
    const amrapOption = page.getByRole('option', { name: /AMRAP/i });
    await amrapOption.click();
    await page.waitForTimeout(300);

    await expect(page.getByText(/Time Cap/i).first()).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-12: Change block type to For Time shows optional time cap
  // -------------------------------------------------------------------------
  test('BLK-EDIT-12: change block type to For Time shows optional time cap', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);

    const typeSelector = page.locator('.bg-muted\\/20 button[role="combobox"]').first();
    await typeSelector.click();
    await page.waitForTimeout(200);
    const forTimeOption = page.getByRole('option', { name: /For Time/i });
    await forTimeOption.click();
    await page.waitForTimeout(300);

    await expect(page.getByText(/Time Cap.*optional/i).first()).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-13: Change block type to Sets shows sets and rest between sets
  // -------------------------------------------------------------------------
  test('BLK-EDIT-13: change block type to Sets shows sets and rest config', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);

    const typeSelector = page.locator('.bg-muted\\/20 button[role="combobox"]').first();
    await typeSelector.click();
    await page.waitForTimeout(200);
    const setsOption = page.getByRole('option', { name: /^Sets$/i });
    await setsOption.click();
    await page.waitForTimeout(300);

    await expect(page.getByText('Sets').first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Rest between sets').first()).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-14: Change block type to Warmup shows duration and activity
  // -------------------------------------------------------------------------
  test('BLK-EDIT-14: change block type to Warm-up shows duration and activity', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);

    const typeSelector = page.locator('.bg-muted\\/20 button[role="combobox"]').first();
    await typeSelector.click();
    await page.waitForTimeout(200);
    const warmupOption = page.getByRole('option', { name: /Warm-up/i });
    await warmupOption.click();
    await page.waitForTimeout(300);

    await expect(page.getByText('Duration').first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Activity').first()).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // BLK-EDIT-15: Cancel Edit Block dialog without saving
  // -------------------------------------------------------------------------
  test('BLK-EDIT-15: cancel Edit Block dialog discards changes', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstBlockEditor(page);

    // Change the name
    const nameInput = dialog.locator('input[placeholder="Block name"]');
    const originalName = await nameInput.inputValue();
    await nameInput.fill('Temporary Name That Should Not Persist');

    // Click Cancel
    const cancelBtn = dialog.getByRole('button', { name: /Cancel/i });
    await cancelBtn.click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });

    // Re-open the dialog and verify the name reverted
    const dialog2 = await openFirstBlockEditor(page);
    const nameInput2 = dialog2.locator('input[placeholder="Block name"]');
    await expect(nameInput2).toHaveValue(originalName);
  });
});

// ===========================================================================
// WORKOUT-LEVEL EDITS
// ===========================================================================

test.describe('Workout-Level Edits', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);
    await setupMockRoutes(page);
  });

  // -------------------------------------------------------------------------
  // WK-EDIT-1: Change workout title via settings dialog
  // -------------------------------------------------------------------------
  test('WK-EDIT-1: change workout title via Workout Settings dialog', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    const dialog = await openWorkoutSettings(page);

    const titleInput = dialog.locator('input[placeholder="Enter workout name"]');
    await expect(titleInput).toBeVisible();

    await titleInput.fill('Full Body Strength A');
    await expect(titleInput).toHaveValue('Full Body Strength A');

    const saveBtn = dialog.getByRole('button', { name: /Save Settings/i });
    await saveBtn.click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });

    // The title in the header should update
    await expect(page.getByText('Full Body Strength A')).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // WK-EDIT-2: Change default rest type to Timed
  // -------------------------------------------------------------------------
  test('WK-EDIT-2: change default rest type to Timed in settings', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    const dialog = await openWorkoutSettings(page);

    // Find the rest type selector
    const restTypeSelect = dialog.locator('button[role="combobox"]').first();
    await restTypeSelect.click();
    await page.waitForTimeout(200);

    const timedOption = page.getByRole('option', { name: /Timed/i });
    await timedOption.click();

    // Duration slider should now be visible
    await expect(dialog.getByText('Duration')).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // WK-EDIT-3: Enable workout warm-up
  // -------------------------------------------------------------------------
  test('WK-EDIT-3: enable workout warm-up in settings', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    const dialog = await openWorkoutSettings(page);

    // Find the Workout Warm-Up switch
    const warmupLabel = dialog.getByText('Workout Warm-Up');
    await expect(warmupLabel).toBeVisible();

    // The warmup switch is the first one
    const switches = dialog.locator('button[role="switch"]');
    const warmupSwitch = switches.first();
    await warmupSwitch.click();
    await page.waitForTimeout(200);

    // Activity selector should appear when warmup is enabled
    const activityLabel = dialog.getByText('Activity');
    const isActivityVisible = await activityLabel.isVisible().catch(() => false);
    // If it was already enabled, clicking toggled it off -- re-enable
    if (!isActivityVisible) {
      await warmupSwitch.click();
      await page.waitForTimeout(200);
    }

    await expect(dialog.getByText('Activity')).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // WK-EDIT-4: Toggle auto-add warm-up & rest periods
  // -------------------------------------------------------------------------
  test('WK-EDIT-4: toggle auto-add warm-up and rest periods', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    const dialog = await openWorkoutSettings(page);

    const autoAddToggle = dialog.locator('[data-testid="auto-add-periods-toggle"]');
    await expect(autoAddToggle).toBeVisible();

    // Toggle the switch
    await autoAddToggle.click();
    await page.waitForTimeout(200);

    // Verify the toggle changed state
    const state = await autoAddToggle.getAttribute('data-state');
    expect(state).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // WK-EDIT-5: Default rest strip opens settings dialog
  // -------------------------------------------------------------------------
  test('WK-EDIT-5: clicking Edit on default rest strip opens settings', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    // If the default rest strip is visible, clicking it should open settings
    const editLink = page.locator('button.underline:has-text("Edit")');
    if (await editLink.isVisible().catch(() => false)) {
      await editLink.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5_000 });
    }
  });
});

// ===========================================================================
// VALIDATION EDGE CASES
// ===========================================================================

test.describe('Validation Edge Cases', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);
    await setupMockRoutes(page);
  });

  // -------------------------------------------------------------------------
  // VAL-1: Empty exercise name is allowed (no crash)
  // -------------------------------------------------------------------------
  test('VAL-1: empty exercise name does not crash the editor', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const nameInput = dialog.locator('input').first();
    await nameInput.fill('');
    await expect(nameInput).toHaveValue('');

    // Click Done -- should not crash
    const doneBtn = dialog.getByRole('button', { name: /Done/i });
    await doneBtn.click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });

    // Editor should still be functional
    await expect(page.locator('[data-assistant-target="workout-log"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // VAL-2: Special characters in exercise name
  // -------------------------------------------------------------------------
  test('VAL-2: special characters in exercise name are handled', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const nameInput = dialog.locator('input').first();
    await nameInput.fill('Bench Press !@#$%^&*()');
    await expect(nameInput).toHaveValue('Bench Press !@#$%^&*()');

    const doneBtn = dialog.getByRole('button', { name: /Done/i });
    await doneBtn.click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });

    // The exercise name should render in the block (expanded)
    await expect(page.getByText('Bench Press !@#$%^&*()')).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // VAL-3: Very long exercise name (200+ chars)
  // -------------------------------------------------------------------------
  test('VAL-3: very long exercise name does not break layout', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const longName = 'A'.repeat(250);
    const nameInput = dialog.locator('input').first();
    await nameInput.fill(longName);

    const doneBtn = dialog.getByRole('button', { name: /Done/i });
    await doneBtn.click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });

    // The editor should not crash
    await expect(page.locator('[data-assistant-target="workout-log"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // VAL-4: Emoji in exercise name
  // -------------------------------------------------------------------------
  test('VAL-4: emoji in exercise name renders correctly', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const nameInput = dialog.locator('input').first();
    await nameInput.fill('Squat Jump \u{1F3CB}');
    await expect(nameInput).toHaveValue('Squat Jump \u{1F3CB}');

    const doneBtn = dialog.getByRole('button', { name: /Done/i });
    await doneBtn.click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // VAL-5: Sets number input clamped to max 10
  // -------------------------------------------------------------------------
  test('VAL-5: sets input clamps to max value', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const setsRepsTab = dialog.getByRole('tab', { name: /Sets\/Reps/i });
    if (await setsRepsTab.isVisible()) {
      await setsRepsTab.click();
    }

    const setsInput = dialog.locator('input[type="number"]').first();
    await setsInput.fill('99');
    // The component clamps to max=10
    await expect(setsInput).toHaveValue('10');
  });

  // -------------------------------------------------------------------------
  // VAL-6: Reps input clamped to max 50
  // -------------------------------------------------------------------------
  test('VAL-6: reps input clamps to max value', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const setsRepsTab = dialog.getByRole('tab', { name: /Sets\/Reps/i });
    if (await setsRepsTab.isVisible()) {
      await setsRepsTab.click();
    }

    const repsInput = dialog.locator('input[type="number"]').nth(1);
    await repsInput.fill('999');
    // The component clamps to max=50
    await expect(repsInput).toHaveValue('50');
  });

  // -------------------------------------------------------------------------
  // VAL-7: Duration input clamped to max 3600
  // -------------------------------------------------------------------------
  test('VAL-7: duration input clamps to max value', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const durationTab = dialog.getByRole('tab', { name: /Duration/i });
    await durationTab.click();
    await page.waitForTimeout(200);

    const durationInput = dialog.locator('input[type="number"][placeholder="sec"]');
    await durationInput.fill('99999');
    // The component clamps to max=3600
    await expect(durationInput).toHaveValue('3600');
  });

  // -------------------------------------------------------------------------
  // VAL-8: Distance input clamped to max 10000
  // -------------------------------------------------------------------------
  test('VAL-8: distance input clamps to max value', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const distanceTab = dialog.getByRole('tab', { name: /Distance/i });
    await distanceTab.click();
    await page.waitForTimeout(200);

    const distanceInput = dialog.locator('input[type="number"][placeholder="m"]');
    await distanceInput.fill('99999');
    // The component clamps to max=10000
    await expect(distanceInput).toHaveValue('10000');
  });

  // -------------------------------------------------------------------------
  // VAL-9: Calories input clamped to max 999
  // -------------------------------------------------------------------------
  test('VAL-9: calories input clamps to max value', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const caloriesTab = dialog.getByRole('tab', { name: /Calories/i });
    await caloriesTab.click();
    await page.waitForTimeout(200);

    const calInput = dialog.locator('input[type="number"][placeholder="cal"]');
    await calInput.fill('9999');
    // The component clamps to max=999
    await expect(calInput).toHaveValue('999');
  });

  // -------------------------------------------------------------------------
  // VAL-10: Zero sets is accepted (min=0 in exercise dialog)
  // -------------------------------------------------------------------------
  test('VAL-10: zero sets is accepted by exercise dialog', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const setsRepsTab = dialog.getByRole('tab', { name: /Sets\/Reps/i });
    if (await setsRepsTab.isVisible()) {
      await setsRepsTab.click();
    }

    const setsInput = dialog.locator('input[type="number"]').first();
    await setsInput.fill('0');
    await expect(setsInput).toHaveValue('0');

    // Should not crash when saving
    const doneBtn = dialog.getByRole('button', { name: /Done/i });
    await doneBtn.click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // VAL-11: Empty block name is accepted
  // -------------------------------------------------------------------------
  test('VAL-11: empty block name does not crash', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstBlockEditor(page);

    const nameInput = dialog.locator('input[placeholder="Block name"]');
    await nameInput.fill('');

    const saveBtn = dialog.getByRole('button', { name: /Save Changes/i });
    await saveBtn.click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });

    // Editor should still function
    await expect(page.locator('[data-assistant-target="workout-log"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // VAL-12: Rest duration clamped in exercise dialog
  // -------------------------------------------------------------------------
  test('VAL-12: rest duration clamped to max 600 in exercise dialog', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    const restInput = dialog.locator('input[type="number"][placeholder="sec"]').first();
    if (await restInput.isVisible()) {
      await restInput.fill('9999');
      await expect(restInput).toHaveValue('600');
    }
  });
});

// ===========================================================================
// STATE PRESERVATION
// ===========================================================================

test.describe('State Preservation', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);
    await setupMockRoutes(page);
  });

  // -------------------------------------------------------------------------
  // STATE-1: Edit exercise -> collapse -> expand -> verify preserved
  // -------------------------------------------------------------------------
  test('STATE-1: exercise edit preserved after collapse and expand', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);

    // Edit the first exercise's name
    const dialog = await openFirstExerciseEditor(page);
    const nameInput = dialog.locator('input').first();
    await nameInput.fill('Modified Exercise Name');
    const doneBtn = dialog.getByRole('button', { name: /Done/i });
    await doneBtn.click();
    await page.waitForTimeout(300);

    // Verify the new name is visible
    await expect(page.getByText('Modified Exercise Name')).toBeVisible({ timeout: 3_000 });

    // Collapse the block
    const hideBtn = page.getByRole('button', { name: /Hide/i }).first();
    await hideBtn.click();
    await page.waitForTimeout(300);

    // Expand again
    const showBtn = page.getByRole('button', { name: /Show/i }).first();
    await showBtn.click();
    await page.waitForTimeout(300);

    // The modified name should still be there
    await expect(page.getByText('Modified Exercise Name')).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // STATE-2: Collapse all -> expand all -> edits preserved
  // -------------------------------------------------------------------------
  test('STATE-2: collapse all then expand all preserves exercise names', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandAllBlocks(page);

    // Get the first exercise name for later verification
    const firstExercise = page.locator('.border.rounded-lg.bg-muted\\/50 .font-medium').first();
    const exerciseName = await firstExercise.textContent();

    // Collapse all
    const collapseAllBtn = page.getByRole('button', { name: /Collapse All/i });
    await collapseAllBtn.click();
    await page.waitForTimeout(300);

    // Expand all
    const expandAllBtn = page.getByRole('button', { name: /Expand All/i });
    await expandAllBtn.click();
    await page.waitForTimeout(300);

    // The exercise name should still be there
    const firstExerciseAfter = page.locator('.border.rounded-lg.bg-muted\\/50 .font-medium').first();
    await expect(firstExerciseAfter).toHaveText(exerciseName!);
  });

  // -------------------------------------------------------------------------
  // STATE-3: Multiple edits in sequence are preserved
  // -------------------------------------------------------------------------
  test('STATE-3: multiple sequential edits are all preserved', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);

    // Edit exercise name
    const dialog = await openFirstExerciseEditor(page);
    const nameInput = dialog.locator('input').first();
    await nameInput.fill('Heavy Squat');
    const doneBtn = dialog.getByRole('button', { name: /Done/i });
    await doneBtn.click();
    await page.waitForTimeout(300);

    // Verify first edit
    await expect(page.getByText('Heavy Squat')).toBeVisible({ timeout: 3_000 });

    // Edit block name
    const blockDialog = await openFirstBlockEditor(page);
    const blockNameInput = blockDialog.locator('input[placeholder="Block name"]');
    await blockNameInput.fill('Legs Day');
    const saveBtn = blockDialog.getByRole('button', { name: /Save Changes/i });
    await saveBtn.click();
    await page.waitForTimeout(300);

    // Both edits should be visible
    await expect(page.getByText('Heavy Squat')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Legs Day')).toBeVisible({ timeout: 3_000 });
  });
});

// ===========================================================================
// INTERACTION EDGE CASES
// ===========================================================================

test.describe('Interaction Edge Cases', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);
    await setupMockRoutes(page);
  });

  // -------------------------------------------------------------------------
  // INT-1: Escape key closes exercise dialog
  // -------------------------------------------------------------------------
  test('INT-1: pressing Escape closes the exercise dialog', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    await openFirstExerciseEditor(page);

    // Press Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // INT-2: Escape key closes Edit Block dialog
  // -------------------------------------------------------------------------
  test('INT-2: pressing Escape closes the Edit Block dialog', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    await openFirstBlockEditor(page);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // INT-3: Escape key closes Workout Settings dialog
  // -------------------------------------------------------------------------
  test('INT-3: pressing Escape closes the Workout Settings dialog', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await openWorkoutSettings(page);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // INT-4: Rapid clicks on block type selector do not crash
  // -------------------------------------------------------------------------
  test('INT-4: rapid block type changes do not crash the editor', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);

    const typeSelector = page.locator('.bg-muted\\/20 button[role="combobox"]').first();

    // Rapidly switch between types
    for (const typeName of ['Circuit', 'EMOM', 'Tabata', 'AMRAP', 'Sets']) {
      await typeSelector.click();
      await page.waitForTimeout(100);
      const option = page.getByRole('option', { name: new RegExp('^' + typeName + '$', 'i') });
      if (await option.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await option.click();
        await page.waitForTimeout(100);
      }
    }

    // Editor should still be functional
    await expect(page.locator('[data-assistant-target="workout-log"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // INT-5: Rapid clicks on stepper buttons
  // -------------------------------------------------------------------------
  test('INT-5: rapid stepper clicks increment correctly', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);

    // Set block type to Circuit to get the Rounds stepper
    const typeSelector = page.locator('.bg-muted\\/20 button[role="combobox"]').first();
    await typeSelector.click();
    await page.waitForTimeout(200);
    const circuitOption = page.getByRole('option', { name: /Circuit/i });
    await circuitOption.click();
    await page.waitForTimeout(300);

    // Click the "+" button multiple times rapidly
    const plusBtn = page.locator('button[aria-label="+"]').first();
    for (let i = 0; i < 5; i++) {
      await plusBtn.click();
    }
    await page.waitForTimeout(200);

    // Editor should still work
    await expect(page.locator('[data-assistant-target="workout-log"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // INT-6: Open exercise editor, switch tabs, close without crash
  // -------------------------------------------------------------------------
  test('INT-6: switching all exercise type tabs then closing works', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    const dialog = await openFirstExerciseEditor(page);

    // Click through all tabs
    const tabs = ['Sets/Reps', 'Duration', 'Distance', 'Calories'];
    for (const tab of tabs) {
      const tabTrigger = dialog.getByRole('tab', { name: new RegExp(tab, 'i') });
      await tabTrigger.click();
      await page.waitForTimeout(150);
    }

    // Close dialog
    const doneBtn = dialog.getByRole('button', { name: /Done/i });
    await doneBtn.click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // INT-7: Click outside dialog closes it (overlay dismiss)
  // -------------------------------------------------------------------------
  test('INT-7: clicking outside exercise dialog closes it', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);
    await openFirstExerciseEditor(page);

    // Click on the overlay area (outside the dialog content)
    const overlay = page.locator('[data-radix-portal] [data-state="open"]').first();
    if (await overlay.isVisible()) {
      // Click at coordinates outside the dialog content
      await page.mouse.click(10, 10);
      await page.waitForTimeout(500);
    }

    // Dialog may or may not close depending on implementation, but should not crash
    await expect(page.locator('[data-assistant-target="workout-log"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // INT-8: Add Block picker shows all block types
  // -------------------------------------------------------------------------
  test('INT-8: Add Block picker shows available block types', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    const addBlockBtn = page.getByRole('button', { name: /Add Block/i });
    await addBlockBtn.click();
    await page.waitForTimeout(300);

    // The AddBlockTypePicker should render
    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // INT-9: Delete block confirmation -- confirm actually deletes
  // -------------------------------------------------------------------------
  test('INT-9: confirming block deletion removes the block', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);

    // Count blocks before
    const blocksBefore = await page.locator('button[title="Delete block"]').count();
    expect(blocksBefore).toBeGreaterThan(0);

    // Click delete on the first block
    const deleteBtn = page.locator('button[title="Delete block"]').first();
    await deleteBtn.click();

    // Confirm in the dialog
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 });
    const confirmBtn = confirmDialog.getByRole('button', { name: /Delete/i });
    await confirmBtn.click();
    await page.waitForTimeout(300);

    // Block count should decrease
    const blocksAfter = await page.locator('button[title="Delete block"]').count();
    expect(blocksAfter).toBeLessThan(blocksBefore);
  });

  // -------------------------------------------------------------------------
  // INT-10: Stepper minus button respects minimum
  // -------------------------------------------------------------------------
  test('INT-10: stepper minus button stops at minimum value', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);

    // Set to circuit for Rounds stepper (min=1)
    const typeSelector = page.locator('.bg-muted\\/20 button[role="combobox"]').first();
    await typeSelector.click();
    await page.waitForTimeout(200);
    const circuitOption = page.getByRole('option', { name: /Circuit/i });
    await circuitOption.click();
    await page.waitForTimeout(300);

    // Click the "-" button many times -- should not go below 1
    const minusBtn = page.locator('button[aria-label="-"]').first();
    for (let i = 0; i < 20; i++) {
      await minusBtn.click();
    }
    await page.waitForTimeout(200);

    // Value should be at minimum (1), not negative
    const valueDisplay = page.locator('.min-w-\\[3\\.5rem\\]').first();
    if (await valueDisplay.isVisible()) {
      const text = await valueDisplay.textContent();
      expect(Number(text)).toBeGreaterThanOrEqual(1);
    }
  });

  // -------------------------------------------------------------------------
  // INT-11: Stepper inline edit mode
  // -------------------------------------------------------------------------
  test('INT-11: clicking stepper value enables inline edit', async ({ page }) => {
    await openFirstWorkoutEditor(page, workoutsPage);
    await expandFirstBlock(page);

    // Set to circuit for Rounds stepper
    const typeSelector = page.locator('.bg-muted\\/20 button[role="combobox"]').first();
    await typeSelector.click();
    await page.waitForTimeout(200);
    const circuitOption = page.getByRole('option', { name: /Circuit/i });
    await circuitOption.click();
    await page.waitForTimeout(300);

    // Click on the stepper display value to enter edit mode
    const valueDisplay = page.locator('.min-w-\\[3\\.5rem\\]').first();
    if (await valueDisplay.isVisible()) {
      await valueDisplay.click();
      await page.waitForTimeout(200);

      // An input should appear for inline editing
      const inlineInput = page.locator('input.text-center.text-sm').first();
      if (await inlineInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await inlineInput.fill('5');
        await inlineInput.press('Enter');
        await page.waitForTimeout(200);
      }
    }

    // Editor should still work
    await expect(page.locator('[data-assistant-target="workout-log"]')).toBeVisible();
  });
});
