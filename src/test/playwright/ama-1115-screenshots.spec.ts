/**
 * AMA-1115: Playwright screenshots for "Generate my week" feature.
 *
 * Takes screenshots showing:
 * 1. "Generate my week" button
 * 2. Generated week with mixed sources
 * 3. Conflict warning
 * 4. Missed session prompt
 */

import { test, expect } from '@playwright/test';

const PREVIEW_URL = '/training-week-preview.html';

test.describe('AMA-1115 Training Week Screenshots', () => {
  test('capture initial state with Generate button and missed session', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForSelector('[data-testid="training-week-view"]');
    await page.waitForTimeout(500);

    // Screenshot 1: Initial view with "Generate my week" button and missed session prompt
    await page.screenshot({
      path: '/tmp/ama-1115-generate-button.png',
      fullPage: true,
    });

    // Verify the button exists
    const btn = page.getByTestId('generate-week-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Generate my week');

    // Verify missed session prompt
    const missedPrompt = page.getByTestId('missed-session-prompt-mon-run-missed');
    await expect(missedPrompt).toBeVisible();
  });

  test('capture generated week with conflict warning', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForSelector('[data-testid="training-week-view"]');

    // Click "Generate my week"
    const btn = page.getByTestId('generate-week-btn');
    await btn.click();

    // Wait for generation to complete (1.2s simulated delay)
    await expect(btn).toContainText('Generating...');
    await expect(btn).toContainText('Generate my week', { timeout: 5000 });
    await page.waitForTimeout(300);

    // Screenshot 2: Generated week with mixed sources (Stryd blue, AmakaFlow green)
    await page.screenshot({
      path: '/tmp/ama-1115-generated-week.png',
      fullPage: true,
    });

    // Screenshot 3: Conflict warning banner
    const conflictBanner = page.getByTestId('conflict-warning-banner');
    await expect(conflictBanner).toBeVisible();
    await conflictBanner.screenshot({
      path: '/tmp/ama-1115-conflict-warning.png',
    });
  });

  test('capture missed session prompt', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForSelector('[data-testid="training-week-view"]');
    await page.waitForTimeout(500);

    // Screenshot 4: Missed session prompt
    const missedPrompt = page.getByTestId('missed-session-prompt-mon-run-missed');
    await expect(missedPrompt).toBeVisible();
    await missedPrompt.screenshot({
      path: '/tmp/ama-1115-missed-session.png',
    });
  });
});
