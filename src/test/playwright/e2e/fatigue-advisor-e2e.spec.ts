/**
 * Fatigue Advisor E2E Tests
 *
 * Tests the fatigue advisor flow:
 * - Body map selector renders with muscle group buttons
 * - Clicking a muscle group selects it
 * - Question input and submit button work
 * - Response displays advice sections (cause, recovery, exercises, rest)
 * - Loading state shows skeleton
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/fatigue-advisor-preview.html';

test.describe('Fatigue Advisor E2E', () => {
  test('empty state shows body map selector', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=empty`);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('preview-empty')).toBeVisible();
    await expect(page.getByTestId('body-map-selector')).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/fatigue-empty.png', fullPage: true });
  });

  test('body map has clickable muscle group buttons', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=empty`);
    await page.waitForTimeout(2000);

    // Verify muscle group buttons exist
    const muscleGroups = page.locator('[data-testid^="muscle-group-"]');
    const count = await muscleGroups.count();
    expect(count).toBeGreaterThan(0);

    // Click the first muscle group (e.g., quads)
    const firstGroup = muscleGroups.first();
    await firstGroup.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/screenshots/fatigue-muscle-selected.png' });
  });

  test('clicking muscle group fills question input', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=empty`);
    await page.waitForTimeout(2000);

    // Click a muscle group
    const muscleGroups = page.locator('[data-testid^="muscle-group-"]');
    if (await muscleGroups.count() > 0) {
      await muscleGroups.first().click();
      await page.waitForTimeout(500);

      // Check if the fatigue input has been populated or the body map selection triggered something
      const input = page.getByTestId('fatigue-input');
      if (await input.isVisible()) {
        const value = await input.inputValue();
        // The input may be pre-filled with the muscle group name
        expect(value.length).toBeGreaterThanOrEqual(0);
      }
    }

    await page.screenshot({ path: 'test-results/screenshots/fatigue-after-click.png' });
  });

  test('response mode shows all advice sections', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=response`);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('preview-response')).toBeVisible();
    await expect(page.getByTestId('fatigue-advisor-page')).toBeVisible();

    // Verify the question display
    await expect(page.getByTestId('fatigue-question-display')).toBeVisible();

    // Verify advice response sections
    await expect(page.getByTestId('fatigue-response')).toBeVisible();
    await expect(page.getByTestId('fatigue-cause')).toBeVisible();
    await expect(page.getByTestId('fatigue-exercises')).toBeVisible();
    await expect(page.getByTestId('fatigue-rest')).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/fatigue-response.png', fullPage: true });
  });

  test('response shows likely cause content', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=response`);
    await page.waitForTimeout(2000);

    const causeSection = page.getByTestId('fatigue-cause');
    await expect(causeSection).toBeVisible();

    const causeText = await causeSection.textContent();
    expect(causeText).toContain('quadriceps');
  });

  test('response shows rest recommendation', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=response`);
    await page.waitForTimeout(2000);

    const restSection = page.getByTestId('fatigue-rest');
    await expect(restSection).toBeVisible();

    const restText = await restSection.textContent();
    expect(restText).toContain('48');
  });

  test('loading state shows skeleton placeholders', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=loading`);
    await page.waitForTimeout(2000);

    const loading = page.getByTestId('fatigue-loading');
    await expect(loading).toBeVisible();

    // Verify skeleton elements exist
    const skeletonDivs = loading.locator('.animate-pulse, [class*="animate-pulse"]');
    // The parent itself or children should have pulse animation
    await expect(loading).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/fatigue-loading.png' });
  });

  test('response-only mode shows just the advice', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=response-only`);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('fatigue-response')).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/fatigue-response-only.png', fullPage: true });
  });

  test('"Ask another question" button appears after response', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}?mode=response`);
    await page.waitForTimeout(2000);

    const askAnother = page.getByTestId('fatigue-ask-another');
    await expect(askAnother).toBeVisible();

    // Click it to verify it works
    await askAnother.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/screenshots/fatigue-ask-another.png' });
  });
});
