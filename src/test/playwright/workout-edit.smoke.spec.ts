/**
 * Workout Edit (from Library) Smoke Tests
 *
 * Verifies the edit-from-library journey shows exactly the right controls
 * for that context and hides controls that belong to other contexts.
 *
 * This spec was introduced after a regression where "Export Destination"
 * appeared on the library-edit screen because hideExport was only set for
 * the import context, not the history context. These tests catch that
 * class of bug: the right UI for the right context.
 *
 * Context matrix this file covers:
 *   ┌─────────────────────────┬──────────────┬──────────────────────┐
 *   │ Context                 │ Should show  │ Should NOT show      │
 *   ├─────────────────────────┼──────────────┼──────────────────────┤
 *   │ Edit from library       │ Save Changes │ Export Destination   │
 *   │                         │ Back to      │ Export to iOS        │
 *   │                         │ History      │ Copy JSON            │
 *   └─────────────────────────┴──────────────┴──────────────────────┘
 *
 * Tags: @smoke
 *
 * Usage:
 *   npx playwright test workout-edit.smoke.spec.ts --project=smoke
 */

import { test, expect } from '@playwright/test';
import { WorkoutsPage } from './pages/WorkoutsPage';

test.describe('Workout Edit (from Library) Smoke Tests @smoke', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();
  });

  // ---------------------------------------------------------------------------
  // WEEDIT-1: Correct controls visible — the core regression guard
  // ---------------------------------------------------------------------------

  test('WEEDIT-1: edit from library shows Save Changes and hides Export Destination', async ({ page }) => {
    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length, 'Need at least one workout in demo data').toBeGreaterThan(0);

    await workoutsPage.clickEditButton(ids[0]);

    // Must wait for StructureWorkout to mount
    await page.getByText('Back to History').waitFor({ state: 'visible', timeout: 10_000 });

    // ── Should be visible ──────────────────────────────────────────────────
    await expect(page.getByRole('button', { name: /Save Changes/i })).toBeVisible();
    await expect(page.getByText('Back to History')).toBeVisible();

    // ── Should NOT be visible ──────────────────────────────────────────────
    await expect(page.getByText('Export Destination')).not.toBeVisible();
    // "Export to <device>" button only appears when export destination is visible
    await expect(page.getByRole('button', { name: /^Export to/i })).not.toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // WEEDIT-2: Navigation — edit button opens the workout editor
  // ---------------------------------------------------------------------------

  test('WEEDIT-2: clicking edit opens the workout editor', async ({ page }) => {
    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length).toBeGreaterThan(0);

    await workoutsPage.clickEditButton(ids[0]);

    // The StructureWorkout view is inside data-assistant-target="workout-log"
    const editor = page.locator('[data-assistant-target="workout-log"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Header text confirms we're in edit mode
    await expect(page.getByText('Edit Workout')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // WEEDIT-3: Navigation — Back to History returns to the workout list
  // ---------------------------------------------------------------------------

  test('WEEDIT-3: Back to History returns to the workout list', async ({ page }) => {
    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length).toBeGreaterThan(0);

    await workoutsPage.clickEditButton(ids[0]);
    await page.getByText('Back to History').waitFor({ state: 'visible', timeout: 10_000 });

    await page.getByText('Back to History').click();

    // Workout list should be visible again
    await expect(
      page.locator('[data-assistant-target="library-results"]')
    ).toBeVisible({ timeout: 10_000 });
  });
});
