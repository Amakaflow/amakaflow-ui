/**
 * AMA-1130: Playwright screenshots for "Paste from AI" workout import.
 *
 * Takes screenshots showing:
 * 1. Empty modal (initial state)
 * 2. Pasted text (before parse)
 * 3. Parsed preview (structured view)
 * 4. Edited preview (after inline edit)
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/workout-import-preview.html';

const SAMPLE_WORKOUT = `Main Lifts:
4x8 Bench Press @ RPE 8, 90s rest
4x8 Barbell Row @ RPE 8, 90s rest

Accessories:
3x12 Lateral Raises, 60s rest
3x15 Face Pulls, 60s rest
3x12 Bicep Curls, 60s rest`;

test.describe('AMA-1130 Workout Import Screenshots', () => {
  test('capture empty modal', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(500);

    // Open the modal
    await page.getByTestId('open-import-modal').click();
    await page.waitForSelector('[data-testid="workout-import-modal"]');
    await page.waitForTimeout(300);

    // Screenshot 1: Empty modal
    await page.screenshot({
      path: '/tmp/ama-1130-empty-modal.png',
      fullPage: true,
    });

    // Verify elements
    const textarea = page.getByTestId('workout-text-input');
    await expect(textarea).toBeVisible();
    const parseBtn = page.getByTestId('parse-button');
    await expect(parseBtn).toBeDisabled();
  });

  test('capture pasted text', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(500);

    // Open modal and paste text
    await page.getByTestId('open-import-modal').click();
    await page.waitForSelector('[data-testid="workout-import-modal"]');

    const textarea = page.getByTestId('workout-text-input');
    await textarea.fill(SAMPLE_WORKOUT);
    await page.waitForTimeout(300);

    // Screenshot 2: Pasted text
    await page.screenshot({
      path: '/tmp/ama-1130-pasted-text.png',
      fullPage: true,
    });

    // Parse button should now be enabled
    const parseBtn = page.getByTestId('parse-button');
    await expect(parseBtn).toBeEnabled();
  });

  test('capture parsed preview', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(500);

    // Open modal, paste, and parse
    await page.getByTestId('open-import-modal').click();
    await page.waitForSelector('[data-testid="workout-import-modal"]');

    const textarea = page.getByTestId('workout-text-input');
    await textarea.fill(SAMPLE_WORKOUT);

    const parseBtn = page.getByTestId('parse-button');
    await parseBtn.click();

    // Wait for loading state
    await expect(page.getByTestId('loading-state')).toBeVisible();

    // Wait for preview to appear (demo mode has 1.2s delay)
    await expect(page.getByTestId('workout-preview')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);

    // Screenshot 3: Parsed preview
    await page.screenshot({
      path: '/tmp/ama-1130-parsed-preview.png',
      fullPage: true,
    });
  });

  test('capture edited preview', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(500);

    // Open modal, paste, and parse
    await page.getByTestId('open-import-modal').click();
    await page.waitForSelector('[data-testid="workout-import-modal"]');

    const textarea = page.getByTestId('workout-text-input');
    await textarea.fill(SAMPLE_WORKOUT);

    const parseBtn = page.getByTestId('parse-button');
    await parseBtn.click();

    // Wait for preview
    await expect(page.getByTestId('workout-preview')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);

    // Click the edit (pencil) button on the title
    const titleButton = page.locator('[data-testid="workout-preview"] button').first();
    await titleButton.click();

    // Type a new title
    const titleInput = page.locator('[data-testid="workout-preview"] input').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill('My Custom Strength Session');
      await titleInput.press('Enter');
    }
    await page.waitForTimeout(300);

    // Screenshot 4: Edited preview
    await page.screenshot({
      path: '/tmp/ama-1130-edited-preview.png',
      fullPage: true,
    });
  });
});
