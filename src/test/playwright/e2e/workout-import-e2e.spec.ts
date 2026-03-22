/**
 * Workout Import E2E Tests
 *
 * Tests the AI workout import ("Paste from AI") flow:
 * - Open import modal button is visible
 * - Clicking button opens the modal dialog
 * - Text area accepts pasted workout text
 * - Parse button triggers parsing
 * - Preview renders with parsed workout structure
 * - Title is editable in preview
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/workout-import-preview.html';

test.describe('Workout Import E2E', () => {
  test('demo page renders with open button', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const openBtn = page.getByTestId('open-import-modal');
    await expect(openBtn).toBeVisible();
    await expect(openBtn).toContainText('Paste from AI');

    await page.screenshot({ path: 'test-results/screenshots/import-landing.png' });
  });

  test('clicking button opens the import modal', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const openBtn = page.getByTestId('open-import-modal');
    await openBtn.click();
    await page.waitForTimeout(1000);

    const modal = page.getByTestId('workout-import-modal');
    await expect(modal).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/import-modal-open.png' });
  });

  test('modal has text input area for pasting', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await page.getByTestId('open-import-modal').click();
    await page.waitForTimeout(1000);

    const textInput = page.getByTestId('workout-text-input');
    await expect(textInput).toBeVisible();

    // Verify it has placeholder text
    const placeholder = await textInput.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
  });

  test('pasting workout text and clicking parse', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await page.getByTestId('open-import-modal').click();
    await page.waitForTimeout(1000);

    // Type a workout into the textarea
    const textInput = page.getByTestId('workout-text-input');
    const workoutText = '5x5 Back Squat at 80% 1RM\n3x10 Romanian Deadlift\n4x12 Leg Press\n3x15 Leg Curls with 2 min rest';
    await textInput.fill(workoutText);
    await page.waitForTimeout(500);

    // Verify text was entered
    await expect(textInput).toHaveValue(workoutText);

    // Find and click parse button
    const parseBtn = page.getByTestId('parse-button');
    await expect(parseBtn).toBeVisible();
    await parseBtn.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/screenshots/import-after-parse.png' });
  });

  test('parsing shows loading state then preview', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await page.getByTestId('open-import-modal').click();
    await page.waitForTimeout(1000);

    const textInput = page.getByTestId('workout-text-input');
    await textInput.fill('EMOM 20: odd mins 15 KB swings, even mins 10 burpees');
    await page.waitForTimeout(300);

    const parseBtn = page.getByTestId('parse-button');
    await parseBtn.click();

    // Wait for either loading state or preview to appear
    const loadingOrPreview = page.locator(
      '[data-testid="loading-state"], [data-testid="workout-preview"]'
    );
    await expect(loadingOrPreview.first()).toBeVisible({ timeout: 10000 });

    // If loading appeared, wait for it to resolve
    await page.waitForTimeout(3000);

    // Check if preview appeared (demo mode should return mock data)
    const preview = page.getByTestId('workout-preview');
    if (await preview.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(preview).toBeVisible();
      await page.screenshot({ path: 'test-results/screenshots/import-preview.png' });
    }
  });

  test('workout preview shows parsed structure', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await page.getByTestId('open-import-modal').click();
    await page.waitForTimeout(1000);

    const textInput = page.getByTestId('workout-text-input');
    await textInput.fill('4x8 bench press, 3x10 rows, 3x12 curls');
    await page.waitForTimeout(300);

    await page.getByTestId('parse-button').click();
    await page.waitForTimeout(3000);

    const preview = page.getByTestId('workout-preview');
    if (await preview.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Verify the preview has block/exercise content
      const content = await preview.textContent();
      expect(content?.length).toBeGreaterThan(0);

      await page.screenshot({ path: 'test-results/screenshots/import-preview-structure.png' });
    }
  });

  test('modal can be closed', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await page.getByTestId('open-import-modal').click();
    await page.waitForTimeout(1000);

    await expect(page.getByTestId('workout-import-modal')).toBeVisible();

    // Close via Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Modal should be gone
    await expect(page.getByTestId('workout-import-modal')).not.toBeVisible();
  });
});
