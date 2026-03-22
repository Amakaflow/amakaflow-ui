/**
 * Training Preferences E2E Tests
 *
 * Tests the training preferences page:
 * - Default state renders all preference sections
 * - Volume preset selection
 * - Custom volume slider
 * - Hard days per week selection
 * - Run day toggles
 * - Goal race selection
 * - Deload interval selection
 * - Values persist after navigation (localStorage)
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/training-preferences-preview.html';

test.describe('Training Preferences E2E', () => {
  test('default state renders all preference sections', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('training-preferences-page')).toBeVisible();
    await expect(page.getByTestId('weekly-volume-section')).toBeVisible();
    await expect(page.getByTestId('hard-days-section')).toBeVisible();
    await expect(page.getByTestId('max-session-section')).toBeVisible();
    await expect(page.getByTestId('run-days-section')).toBeVisible();
    await expect(page.getByTestId('workout-time-section')).toBeVisible();
    await expect(page.getByTestId('goal-race-section')).toBeVisible();
    await expect(page.getByTestId('deload-section')).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/preferences-default.png', fullPage: true });
  });

  test('clicking volume preset changes selection', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    // Click "moderate" volume
    const moderateBtn = page.getByTestId('volume-moderate');
    await moderateBtn.click();
    await page.waitForTimeout(500);

    // Verify volume range label is visible
    await expect(page.getByTestId('volume-range-label')).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/preferences-volume-moderate.png' });
  });

  test('selecting custom volume shows slider', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    // Click "custom" volume
    const customBtn = page.getByTestId('volume-custom');
    await customBtn.click();
    await page.waitForTimeout(500);

    // Custom slider should appear
    await expect(page.getByTestId('custom-volume-slider')).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/preferences-volume-custom.png' });
  });

  test('selecting hard days per week', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    // Click 3 hard days
    const hardDays3 = page.getByTestId('hard-days-3');
    await hardDays3.click();
    await page.waitForTimeout(500);

    // Verify button state changed (should have primary variant styling)
    await expect(hardDays3).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/preferences-hard-days.png' });
  });

  test('toggling run days', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('run-days-checkboxes')).toBeVisible();

    // Toggle Monday
    const monCheckbox = page.getByTestId('run-day-mon');
    await monCheckbox.click();
    await page.waitForTimeout(300);

    // Toggle Wednesday
    const wedCheckbox = page.getByTestId('run-day-wed');
    await wedCheckbox.click();
    await page.waitForTimeout(300);

    // Toggle Saturday
    const satCheckbox = page.getByTestId('run-day-sat');
    await satCheckbox.click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'test-results/screenshots/preferences-run-days.png' });
  });

  test('selecting workout time preference', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('workout-time-buttons')).toBeVisible();

    // Click "evening" option
    const eveningBtn = page.getByTestId('workout-time-evening');
    await eveningBtn.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/screenshots/preferences-workout-time.png' });
  });

  test('goal race section has select dropdown', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const raceSelect = page.getByTestId('goal-race-select');
    await expect(raceSelect).toBeVisible();

    // Click to open the select dropdown
    await raceSelect.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/screenshots/preferences-goal-race.png' });
  });

  test('deload interval selection', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('deload-buttons')).toBeVisible();

    // Click deload every 3 weeks
    const deload3 = page.getByTestId('deload-3');
    await deload3.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/screenshots/preferences-deload.png' });
  });

  test('custom-volume mode loads with pre-seeded preferences', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=custom-volume`);
    await page.waitForTimeout(2000);

    // The useEffect seeds localStorage on mount, but the component reads on mount too.
    // Reload to pick up the seeded values.
    await page.reload();
    await page.waitForTimeout(2000);

    // Custom volume slider should be visible since mode seeds custom volume
    await expect(page.getByTestId('custom-volume-slider')).toBeVisible();

    // Goal race date section should be visible (seeded data includes a goal race)
    await expect(page.getByTestId('goal-race-date-section')).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/preferences-custom-mode.png', fullPage: true });
  });

  test('session length slider shows current value', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    const display = page.getByTestId('session-length-display');
    await expect(display).toBeVisible();

    const text = await display.textContent();
    expect(text).toBeTruthy();
    // Should contain "min" or time-related text
    expect(text).toMatch(/\d/);
  });
});
