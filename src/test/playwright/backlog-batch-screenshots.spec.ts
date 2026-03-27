/**
 * Playwright screenshots for backlog batch improvements.
 *
 * AMA-205: Auto-add warm-up and rest periods
 * AMA-208: Smart workout type detection
 * AMA-914/915/916: Create with AI improvements
 */

import { test, expect } from '@playwright/test';

// ── AMA-914/915/916: Create with AI ─────────────────────────────────────────

test.describe('Create with AI (AMA-914/915/916)', () => {
  const PREVIEW_URL = '/create-ai-preview.html';

  test('screenshot: initial form with presets and title', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(500);

    await page.screenshot({
      path: '/tmp/backlog-create-ai-form.png',
      fullPage: true,
    });

    // AMA-916: title field present
    await expect(page.getByTestId('ai-workout-title')).toBeVisible();

    // AMA-915: preset prompts present
    await expect(page.getByTestId('preset-prompts')).toBeVisible();
    await expect(page.getByText('Upper body strength')).toBeVisible();
    await expect(page.getByText('HIIT circuit')).toBeVisible();
    await expect(page.getByText('Leg day')).toBeVisible();
    await expect(page.getByText('Full body')).toBeVisible();
    await expect(page.getByText('Core workout')).toBeVisible();
  });

  test('screenshot: preset fills description', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(500);

    await page.getByText('Upper body strength').click();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: '/tmp/backlog-create-ai-preset-filled.png',
      fullPage: true,
    });

    const description = page.getByTestId('ai-workout-description');
    await expect(description).toHaveValue(/Upper body strength/);
  });

  test('screenshot: demo mode generates workout', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(500);

    // Set title
    await page.getByTestId('ai-workout-title').fill('Monday Push Day');

    // Select a preset
    await page.getByText('Upper body strength').click();
    await page.waitForTimeout(200);

    // Click generate
    await page.getByTestId('generate-workout-btn').click();

    // Wait for mock delay and result
    await expect(page.getByTestId('generated-workout-view')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);

    await page.screenshot({
      path: '/tmp/backlog-create-ai-generated.png',
      fullPage: true,
    });

    // Verify workout was generated
    await expect(page.getByTestId('generated-title')).toBeVisible();
  });
});

// ── AMA-208: Workout Type Detection ─────────────────────────────────────────

test.describe('Workout Type Detection (AMA-208)', () => {
  const PREVIEW_URL = '/workout-type-detection-preview.html';

  test('screenshot: detection banner for strength', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(500);

    // Click the strength sample
    await page.getByTestId('sample-strength-workout').click();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: '/tmp/backlog-type-detection-strength.png',
      fullPage: true,
    });

    // Banner should be visible
    await expect(page.getByTestId('workout-type-detection-banner')).toBeVisible();
    await expect(page.getByTestId('detection-message')).toContainText('Strength');
  });

  test('screenshot: detection banner for running', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(500);

    await page.getByTestId('sample-running-plan').click();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: '/tmp/backlog-type-detection-running.png',
      fullPage: true,
    });

    await expect(page.getByTestId('detection-message')).toContainText('Running');
  });

  test('screenshot: confirm type', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(500);

    await page.getByTestId('sample-yoga-flow').click();
    await page.waitForTimeout(300);

    // Confirm
    await page.getByTestId('confirm-detection').click();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: '/tmp/backlog-type-detection-confirmed.png',
      fullPage: true,
    });

    await expect(page.getByTestId('confirmed-type')).toBeVisible();
  });
});

// ── AMA-205: Auto-add Periods ──────────────────────────────────────────────

test.describe('Auto-add Periods (AMA-205)', () => {
  const PREVIEW_URL = '/auto-add-periods-preview.html';

  test('screenshot: before and after auto-add', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(500);

    // Before: screenshot original workout
    await page.screenshot({
      path: '/tmp/backlog-auto-add-before.png',
      fullPage: true,
    });

    // Apply
    await page.getByTestId('apply-auto-add').click();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: '/tmp/backlog-auto-add-after.png',
      fullPage: true,
    });

    // Verify warm-up and cooldown blocks appear
    await expect(page.getByTestId('block-warmup')).toBeVisible();
    await expect(page.getByTestId('block-cooldown')).toBeVisible();
  });
});
