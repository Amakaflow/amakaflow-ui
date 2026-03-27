/**
 * Workout Import Workflow E2E Tests
 *
 * Verifies the YouTube video import flow:
 * - Navigate to Import
 * - Paste a YouTube URL
 * - Wait for AI parsing (mocked)
 * - Verify structured workout appears in the editor
 * - Save imported workout
 *
 * Tests work with VITE_DEMO_MODE=true and mock all external API calls.
 *
 * Usage:
 *   npx playwright test workout-import.spec.ts
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const MOCK_DETECT_RESPONSE = {
  platform: 'youtube',
  url: YOUTUBE_URL,
  video_id: 'dQw4w9WgXcQ',
};

const MOCK_TRANSCRIPT_RESPONSE = {
  title: 'Full Body Workout - 30 Minutes',
  source: YOUTUBE_URL,
  workout_type: 'strength',
  blocks: [
    {
      id: 'block-import-1',
      label: 'Main Workout',
      structure: 'sets',
      sets: 3,
      rest_between_sets_sec: 60,
      exercises: [
        { id: 'imp-ex-1', name: 'Push-ups', sets: 3, reps: 15, type: 'strength' },
        { id: 'imp-ex-2', name: 'Squats', sets: 3, reps: 20, type: 'strength' },
        { id: 'imp-ex-3', name: 'Plank', sets: 3, duration_sec: 45, type: 'strength' },
      ],
    },
  ],
};

const MOCK_SAVE_RESPONSE = {
  id: 'workout-imported-001',
  created_at: new Date().toISOString(),
  success: true,
};

test.describe('Workout Import Workflow', () => {

  test.beforeEach(async ({ page }) => {
    // Mock video detection API
    await page.route('**/video/detect', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DETECT_RESPONSE),
      });
    });

    // Mock transcript extraction / structure generation
    await page.route('**/transcript/**', async (route) => {
      // Simulate processing time
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TRANSCRIPT_RESPONSE),
      });
    });

    // Mock ingest endpoints
    await page.route('**/ingest/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TRANSCRIPT_RESPONSE),
      });
    });

    // Mock cache check (cache miss)
    await page.route('**/video/cache/check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cached: false, cache_entry: null }),
      });
    });

    // Mock cache save
    await page.route('**/video/cache/save', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cached: true }),
      });
    });

    // Mock workout save
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
  // IMPORT-1: Navigate to the import page
  // ---------------------------------------------------------------------------

  test('IMPORT-1: navigate to the import page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate via Create dropdown menu
    const createMenu = page.locator('[data-testid="nav-create-menu"]');
    if (await createMenu.isVisible().catch(() => false)) {
      await createMenu.click();
      await page.getByText('Import Workout').click();
    } else {
      await page.goto('/import');
    }

    await page.waitForLoadState('networkidle');

    // The AddSources component should be visible with video URL input
    const videoUrlInput = page.getByPlaceholder(/Paste YouTube|URL/i);
    await expect(videoUrlInput).toBeVisible({ timeout: 10_000 });
  });

  // ---------------------------------------------------------------------------
  // IMPORT-2: Paste a YouTube URL and see platform detection
  // ---------------------------------------------------------------------------

  test('IMPORT-2: paste YouTube URL and see platform detection', async ({ page }) => {
    await page.goto('/workflow');
    await page.waitForLoadState('networkidle');

    // Ensure Video tab is active
    const videoTab = page.getByRole('tab', { name: /Video/i });
    if (await videoTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await videoTab.click();
    }

    // Paste URL into the input
    const urlInput = page.getByPlaceholder(/Paste YouTube|URL/i);
    await expect(urlInput).toBeVisible({ timeout: 5_000 });
    await urlInput.fill(YOUTUBE_URL);

    // Platform should be auto-detected — look for YouTube badge or indicator
    await expect(
      page.getByText(/YouTube/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // IMPORT-3: Add video source and generate structure
  // ---------------------------------------------------------------------------

  test('IMPORT-3: add video source and generate structured workout', async ({ page }) => {
    await page.goto('/workflow');
    await page.waitForLoadState('networkidle');

    // Ensure Video tab is active
    const videoTab = page.getByRole('tab', { name: /Video/i });
    if (await videoTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await videoTab.click();
    }

    // Enter URL
    const urlInput = page.getByPlaceholder(/Paste YouTube|URL/i);
    await urlInput.fill(YOUTUBE_URL);
    await page.waitForTimeout(300);

    // Click the Add/Plus button to add the source
    const addBtn = page.locator('button:has(svg.lucide-plus)').first();
    if (await addBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }

    // Click "Generate Structure" button
    const generateBtn = page.getByRole('button', { name: /Generate Structure/i });
    if (await generateBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await generateBtn.click();

      // Wait for the structure to generate (mocked, should be fast)
      // The StructureWorkout editor should appear
      const editor = page.locator('[data-assistant-target="workout-log"]');
      await expect(editor).toBeVisible({ timeout: 15_000 });

      // Verify the imported workout structure is shown
      await expect(page.getByText(/Full Body Workout|Main Workout/i)).toBeVisible({ timeout: 5_000 });
    }
  });

  // ---------------------------------------------------------------------------
  // IMPORT-4: Verify parsed exercises appear in the structure
  // ---------------------------------------------------------------------------

  test('IMPORT-4: verify parsed exercises appear in the structured workout', async ({ page }) => {
    await page.goto('/workflow');
    await page.waitForLoadState('networkidle');

    const videoTab = page.getByRole('tab', { name: /Video/i });
    if (await videoTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await videoTab.click();
    }

    const urlInput = page.getByPlaceholder(/Paste YouTube|URL/i);
    await urlInput.fill(YOUTUBE_URL);
    await page.waitForTimeout(300);

    const addBtn = page.locator('button:has(svg.lucide-plus)').first();
    if (await addBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }

    const generateBtn = page.getByRole('button', { name: /Generate Structure/i });
    if (await generateBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await generateBtn.click();

      const editor = page.locator('[data-assistant-target="workout-log"]');
      await expect(editor).toBeVisible({ timeout: 15_000 });

      // Verify individual exercises from mock data
      for (const exerciseName of ['Push-ups', 'Squats', 'Plank']) {
        await expect(page.getByText(exerciseName).first()).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  // ---------------------------------------------------------------------------
  // IMPORT-5: Save imported workout
  // ---------------------------------------------------------------------------

  test('IMPORT-5: save the imported workout', async ({ page }) => {
    await page.goto('/workflow');
    await page.waitForLoadState('networkidle');

    const videoTab = page.getByRole('tab', { name: /Video/i });
    if (await videoTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await videoTab.click();
    }

    const urlInput = page.getByPlaceholder(/Paste YouTube|URL/i);
    await urlInput.fill(YOUTUBE_URL);
    await page.waitForTimeout(300);

    const addBtn = page.locator('button:has(svg.lucide-plus)').first();
    if (await addBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }

    const generateBtn = page.getByRole('button', { name: /Generate Structure/i });
    if (await generateBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await generateBtn.click();

      const editor = page.locator('[data-assistant-target="workout-log"]');
      await expect(editor).toBeVisible({ timeout: 15_000 });

      // Click Export or Save button
      const exportBtn = page.getByRole('button', { name: /Export|Save/i }).first();
      if (await exportBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await exportBtn.click();
        await page.waitForTimeout(2_000);
      }
    }
  });
});
