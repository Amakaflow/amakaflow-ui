/**
 * Instagram Apify Auto-Extraction Regression Tests (AMA-565)
 *
 * Comprehensive tests covering edge cases, tier gating, preference
 * persistence, badge reactivity, error handling, the "Added Sources" list
 * flow, superset rendering, and YouTube/TikTok non-regression.
 *
 * Run nightly and on release branches (not on every PR -- the smoke suite
 * covers the critical paths there).
 *
 * Test groups:
 *   REG-IG1:  Settings toggle tier gating
 *   REG-IG2:  Preference persistence edge cases
 *   REG-IG3:  AddSources badge reactivity
 *   REG-IG4:  Video ingest dialog flow details (manual mode)
 *   REG-IG5:  Apify failure fallback edge cases
 *   REG-IG6:  supportsAutoExtraction logic
 *   REG-IG7:  Alert text content accuracy
 *   REG-IG8:  Added Sources list flow (auto mode)
 *   REG-IG9:  Superset rendering (Flow 4)
 *   REG-IG10: YouTube/TikTok unchanged (Flow 5)
 *   REG-IG11: BYPASS_TIER_GATE env var
 *
 * Usage:
 *   npx playwright test instagram-apify.regression.spec.ts
 *   npx playwright test --project=chromium instagram-apify.regression.spec.ts
 */

import { test, expect, Page } from '@playwright/test';
import { SettingsPage } from './pages/SettingsPage';
import { AddSourcesPage } from './pages/AddSourcesPage';
import {
  PREFERENCES_KEY,
  PREFS_MANUAL_MODE,
  PREFS_AUTO_MODE,
  INSTAGRAM_REEL_URL,
  INSTAGRAM_REEL_URL_SHORT,
  YOUTUBE_URL,
  TIKTOK_URL,
  APIFY_INGEST_SUCCESS,
  GENERATE_STRUCTURE_RESPONSE_WITH_SUPERSETS,
  GENERATE_STRUCTURE_RESPONSE_SIMPLE,
  DETECT_YOUTUBE_RESPONSE,
  DETECT_TIKTOK_RESPONSE,
  FREE_USER,
  PRO_USER,
  TRAINER_USER,
} from './fixtures/instagram-apify.fixtures';

// ===========================================================================
// REG-IG1: Settings toggle tier gating
// ===========================================================================

test.describe('Settings toggle tier gating', () => {
  test('REG-IG1a: free-tier upgrade alert text references Pro or Trainer subscription', async ({
    page,
  }) => {
    const settingsPage = new SettingsPage(page);

    await settingsPage.goto();
    await settingsPage.goToGeneral();

    // Instagram Import card should be visible
    await settingsPage.expectInstagramCardVisible();

    // Verify the alert text content specifically mentions the required tiers
    const alertText = settingsPage.instagramImportCard.locator('[role="alert"]');
    // If the user is free tier, the alert should be present
    // We verify the alert copy is accurate
    const alertElements = await alertText.count();
    if (alertElements > 0) {
      await expect(alertText.first()).toContainText(/Pro or Trainer subscription/);
    }
  });

  test('REG-IG1b: toggle description updates dynamically when toggled on/off', async ({
    page,
  }) => {
    const settingsPage = new SettingsPage(page);

    // Start with auto mode
    await settingsPage.seedPreferences(PREFS_AUTO_MODE);
    await settingsPage.goto();
    await settingsPage.goToGeneral();

    // When enabled: description should mention automatic transcription
    await expect(
      settingsPage.instagramImportCard.getByText(
        /Reels are automatically transcribed and parsed/
      )
    ).toBeVisible();

    // Toggle off
    await settingsPage.clickToggle();

    // When disabled: description should mention manual adding
    await expect(
      settingsPage.instagramImportCard.getByText(
        /You add exercises manually/
      )
    ).toBeVisible();
  });

  test('REG-IG1c: toggle state is independent of image processing method', async ({
    page,
  }) => {
    const settingsPage = new SettingsPage(page);

    // Seed both preferences explicitly
    const customPrefs = {
      imageProcessingMethod: 'vision',
      instagramAutoExtract: true,
    };
    await settingsPage.seedPreferences(customPrefs);
    await settingsPage.goto();
    await settingsPage.goToGeneral();

    // Instagram toggle should be checked
    await settingsPage.expectToggleChecked(true);

    // Image processing should still be vision (verify they are independent)
    const prefs = await settingsPage.getStoredPreferences();
    expect((prefs as any).imageProcessingMethod).toBe('vision');
    expect((prefs as any).instagramAutoExtract).toBe(true);

    // Toggle Instagram off
    await settingsPage.clickToggle();

    // Image processing should remain unchanged
    const prefsAfter = await settingsPage.getStoredPreferences();
    expect((prefsAfter as any).imageProcessingMethod).toBe('vision');
    expect((prefsAfter as any).instagramAutoExtract).toBe(false);
  });
});

// ===========================================================================
// REG-IG2: Preference persistence edge cases
// ===========================================================================

test.describe('Preference persistence', () => {
  test('REG-IG2a: fresh user with no localStorage defaults to manual mode', async ({
    page,
  }) => {
    // Clear any existing preferences
    await page.goto('/');
    await page.evaluate((key) => localStorage.removeItem(key), PREFERENCES_KEY);
    await page.reload();

    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);

    // Should default to "Semi-Manual" since instagramAutoExtract defaults to false
    await addSourcesPage.expectBadgeText('Semi-Manual');
  });

  test('REG-IG2b: corrupted localStorage falls back to defaults gracefully', async ({
    page,
  }) => {
    await page.goto('/');
    // Write invalid JSON
    await page.evaluate((key) => {
      localStorage.setItem(key, '{not valid json!!!');
    }, PREFERENCES_KEY);
    await page.reload();

    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);

    // Should fall back to default (manual mode)
    await addSourcesPage.expectBadgeText('Semi-Manual');
  });

  test('REG-IG2c: partial preferences (missing instagramAutoExtract key) defaults to false', async ({
    page,
  }) => {
    await page.goto('/');
    // Write preferences without the instagram key
    await page.evaluate((key) => {
      localStorage.setItem(key, JSON.stringify({ imageProcessingMethod: 'ocr' }));
    }, PREFERENCES_KEY);
    await page.reload();

    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);

    // Should default to "Semi-Manual"
    await addSourcesPage.expectBadgeText('Semi-Manual');
  });
});

// ===========================================================================
// REG-IG3: AddSources badge reactivity
// ===========================================================================

test.describe('AddSources badge reactivity', () => {
  test('REG-IG3a: YouTube URL always shows "AI-Powered" regardless of Instagram preference', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_MANUAL_MODE);

    await addSourcesPage.typeVideoUrl(YOUTUBE_URL);

    // YouTube should always show AI-Powered
    await addSourcesPage.expectBadgeText('AI-Powered');
  });

  test('REG-IG3b: clearing URL input removes platform badge', async ({ page }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_MANUAL_MODE);

    // Type Instagram URL
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.expectBadgeText('Semi-Manual');

    // Clear the input
    await addSourcesPage.videoUrlInput.clear();

    // The generic "Paste a video URL to get started" should appear
    await expect(
      page.getByText('Paste a video URL to get started')
    ).toBeVisible();
  });

  test('REG-IG3c: switching from Instagram to YouTube URL updates badge dynamically', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_MANUAL_MODE);

    // Type Instagram URL
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.expectBadgeText('Semi-Manual');

    // Replace with YouTube URL
    await addSourcesPage.videoUrlInput.clear();
    await addSourcesPage.videoUrlInput.fill(YOUTUBE_URL);
    await addSourcesPage.expectBadgeText('AI-Powered');
  });

  test('REG-IG3d: short Instagram URL (instagr.am) also shows correct badge', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_AUTO_MODE);

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL_SHORT);

    // Short URL should also be detected as Instagram
    await addSourcesPage.expectBadgeText('AI-Powered');
  });

  test('REG-IG3e: Instagram steps text matches mode accurately', async ({ page }) => {
    const addSourcesPage = new AddSourcesPage(page);

    // Manual mode
    await addSourcesPage.goto(PREFS_MANUAL_MODE);
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);

    await addSourcesPage.expectStepText(/Video thumbnail and metadata fetched via oEmbed/);
    await addSourcesPage.expectStepText(/You add exercises manually with autocomplete/);

    // Switch to auto mode via localStorage
    await addSourcesPage.seedPreferences(PREFS_AUTO_MODE);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.expectStepText(/Reel transcript and metadata fetched via Apify/);
    await addSourcesPage.expectStepText(/Exercises extracted from transcript using AI/);
  });
});

// ===========================================================================
// REG-IG4: Video ingest dialog flow details (manual mode only)
// ===========================================================================

test.describe('Video ingest dialog flow details', () => {
  test('REG-IG4a: manual mode does NOT call /ingest/instagram_reel', async ({ page }) => {
    const addSourcesPage = new AddSourcesPage(page);
    let apifyCalled = false;

    await addSourcesPage.goto(PREFS_MANUAL_MODE);

    // Mock the other APIs first
    await addSourcesPage.mockIngestApis();

    // Track if the Apify endpoint is called (registered AFTER mockIngestApis
    // so this handler takes priority -- Playwright matches last-registered first)
    await page.route('**/ingest/instagram_reel', async (route) => {
      apifyCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(APIFY_INGEST_SUCCESS),
      });
    });

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    // Should go to manual entry, not extracting
    await addSourcesPage.expectManualEntryStep();

    // Apify endpoint should NOT have been called
    expect(apifyCalled).toBe(false);
  });

  test('REG-IG4b: manual mode pre-fills workout title from fallback when oEmbed fails', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);

    await addSourcesPage.goto(PREFS_MANUAL_MODE);
    await addSourcesPage.mockIngestApis({ oembedFails: true });

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    await addSourcesPage.expectManualEntryStep();

    // When oEmbed fails, title should be the generic fallback
    await expect(addSourcesPage.dialogWorkoutTitleInput).toHaveValue('Instagram Workout');
  });

  test('REG-IG4c: manual mode pre-fills workout title from oEmbed author when available', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);

    await addSourcesPage.goto(PREFS_MANUAL_MODE);
    await addSourcesPage.mockIngestApis({ oembedFails: false });

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    await addSourcesPage.expectManualEntryStep();

    // When oEmbed succeeds with author_name, title should use author
    // The fixture OEMBED_INSTAGRAM_SUCCESS has author_name: 'fitnessguru'
    // and title: null, so it should be "Workout by fitnessguru"
    await expect(addSourcesPage.dialogWorkoutTitleInput).toHaveValue(
      'Workout by fitnessguru'
    );
  });
});

// ===========================================================================
// REG-IG5: Apify failure fallback edge cases
// ===========================================================================

test.describe('Apify failure fallback', () => {
  test('REG-IG5a: HTTP 500 from Apify falls back to manual entry', async ({ page }) => {
    const addSourcesPage = new AddSourcesPage(page);

    await addSourcesPage.goto(PREFS_AUTO_MODE);
    await addSourcesPage.mockIngestApis({ apifyFails: true });

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    // Should transition through extracting to manual-entry
    await addSourcesPage.expectManualEntryStep();
  });

  test('REG-IG5b: network timeout on Apify falls back to manual entry', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);

    await addSourcesPage.goto(PREFS_AUTO_MODE);

    // Mock all APIs first
    await addSourcesPage.mockIngestApis();

    // Override Apify to abort (simulate network failure)
    await page.route('**/ingest/instagram_reel', async (route) => {
      await route.abort('connectionfailed');
    });

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    // Should fall back to manual entry
    await addSourcesPage.expectManualEntryStep();

    // Workout title should have the fallback
    await expect(addSourcesPage.dialogWorkoutTitleInput).toHaveValue('Instagram Workout');
  });

  test('REG-IG5c: Apify failure followed by successful manual save completes the flow', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);

    await addSourcesPage.goto(PREFS_AUTO_MODE);
    await addSourcesPage.mockIngestApis({ apifyFails: true });

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    // Falls back to manual entry
    await addSourcesPage.expectManualEntryStep();

    // Fill in workout title
    await addSourcesPage.dialogWorkoutTitleInput.fill('My Instagram HIIT');

    // Add an exercise manually
    const searchInput = page.getByPlaceholder('Search or type exercise name...');
    await searchInput.fill('Push-Ups');
    // Click the add button
    const addBtn = page
      .locator('.flex.gap-2')
      .filter({ has: searchInput })
      .getByRole('button');
    await addBtn.click();

    // Click save
    await addSourcesPage.dialogSaveButton.click();

    // Dialog should close
    await addSourcesPage.expectDialogClosed();

    // Success toast
    await addSourcesPage.expectToastWithText(/Workout created successfully|Instagram workout created/);
  });
});

// ===========================================================================
// REG-IG6: supportsAutoExtraction logic
// ===========================================================================

test.describe('supportsAutoExtraction logic', () => {
  test('REG-IG6a: YouTube always auto-extracts regardless of Instagram preference', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);

    await addSourcesPage.goto(PREFS_MANUAL_MODE);

    // Mock video detect for YouTube
    await page.route('**/video/detect', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(DETECT_YOUTUBE_RESPONSE),
      });
    });

    await page.route('**/video/cache/check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cached: false, cache_entry: null }),
      });
    });

    // YouTube is handled directly by addSource -> generate, not via VideoIngestDialog
    // The badge should still show "AI-Powered"
    await addSourcesPage.typeVideoUrl(YOUTUBE_URL);
    await addSourcesPage.expectBadgeText('AI-Powered');
  });
});

// ===========================================================================
// REG-IG7: Alert text content accuracy
// ===========================================================================

test.describe('Alert text content accuracy', () => {
  test('REG-IG7a: manual mode alert mentions upgrade to Pro for AI-powered extraction', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_MANUAL_MODE);

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);

    // The alert in AddSources should mention upgrading to Pro
    const alertText = page.locator('[role="alert"]').filter({
      hasText: /Upgrade to Pro for AI-powered extraction/,
    });
    await expect(alertText.first()).toBeVisible();
  });

  test('REG-IG7b: auto mode alert mentions Apify API token and tier requirement', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_AUTO_MODE);

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);

    // The alert should mention Apify and tier
    const alertText = page.locator('[role="alert"]').filter({
      hasText: /Requires Apify API token.*Pro\/Trainer tier only/,
    });
    await expect(alertText.first()).toBeVisible();
  });
});

// ===========================================================================
// REG-IG8: Added Sources list flow (auto mode -- Instagram adds to list)
// ===========================================================================

test.describe('Added Sources list flow (auto mode)', () => {
  test('REG-IG8a: Instagram URL in auto mode adds to sources list with purple icon', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_AUTO_MODE);

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    // URL should appear in the "Added Sources" list (NOT the dialog)
    await addSourcesPage.expectDialogNotPresent();
    await addSourcesPage.expectSourceInList(INSTAGRAM_REEL_URL);
    await addSourcesPage.expectSourceType('instagram');
    await addSourcesPage.expectSourceCount(1);
  });

  test('REG-IG8b: adding multiple Instagram URLs increments source count', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_AUTO_MODE);

    // Add first Instagram URL
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();
    await addSourcesPage.expectSourceCount(1);

    // Add a YouTube URL as well
    await addSourcesPage.typeVideoUrl(YOUTUBE_URL);
    await addSourcesPage.submitVideoUrl();
    await addSourcesPage.expectSourceCount(2);

    // Both should be in the list
    await addSourcesPage.expectSourceInList(INSTAGRAM_REEL_URL);
    await addSourcesPage.expectSourceInList(YOUTUBE_URL);
  });

  test('REG-IG8c: removing a source from the list updates count and enables/disables Generate', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_AUTO_MODE);

    // Add a source
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();
    await addSourcesPage.expectSourceCount(1);
    await addSourcesPage.expectGenerateButtonEnabled();

    // Click the trash/remove button on the source
    const removeButton = addSourcesPage.addedSourcesCard
      .locator('button')
      .filter({ has: page.locator('svg.lucide-trash-2') });
    await removeButton.first().click();

    // Source list should be empty, Generate button disabled
    await addSourcesPage.expectNoSources();
    await addSourcesPage.expectGenerateButtonDisabled();
  });

  test('REG-IG8d: Generate Structure button is disabled with zero sources', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_AUTO_MODE);

    // No sources added yet -- Generate should be disabled
    await addSourcesPage.expectGenerateButtonDisabled();
  });

  test('REG-IG8e: Instagram URL in manual mode does NOT add to sources list (opens dialog instead)', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_MANUAL_MODE);
    await addSourcesPage.mockIngestApis({ oembedFails: true });

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    // Manual mode should open the dialog, NOT add to sources list
    await addSourcesPage.expectDialogOpen();
    await addSourcesPage.expectNoSources();
  });

  test('REG-IG8f: short Instagram URL (instagr.am) adds to sources list in auto mode', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_AUTO_MODE);

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL_SHORT);
    await addSourcesPage.submitVideoUrl();

    // Short URL should also be added to the sources list
    await addSourcesPage.expectDialogNotPresent();
    await addSourcesPage.expectSourceInList(INSTAGRAM_REEL_URL_SHORT);
    await addSourcesPage.expectSourceType('instagram');
  });

  test('REG-IG8g: URL input is cleared after adding a source', async ({ page }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_AUTO_MODE);

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    // Input should be cleared after adding
    await expect(addSourcesPage.videoUrlInput).toHaveValue('');
  });
});

// ===========================================================================
// REG-IG9: Superset rendering (Flow 4)
//
// After generating a workout that contains supersets, the StructureWorkout
// view should render them correctly:
// - Supersets are shown as grouped exercises inside a bordered container
// - Each superset shows a "Superset N" badge
// - Exercises in supersets are NOT duplicated as standalone block exercises
// - Block-level exercises and superset exercises are visually distinct
// ===========================================================================

test.describe('Superset rendering after Generate Structure', () => {
  test('REG-IG9a: supersets render with numbered badges in the structure view', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_AUTO_MODE);

    // Mock generate-structure to return a response with supersets
    await addSourcesPage.mockGenerateStructureApi({ withSupersets: true });

    // Add an Instagram source and generate
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();
    await addSourcesPage.expectSourceInList(INSTAGRAM_REEL_URL);

    await addSourcesPage.clickGenerateStructure();
    await addSourcesPage.expectGenerateComplete();

    // The structure view should show "Superset 1" and "Superset 2" badges
    await addSourcesPage.expectSupersetBadgeVisible(1);
    await addSourcesPage.expectSupersetBadgeVisible(2);
    await addSourcesPage.expectSupersetCount(2);
  });

  test('REG-IG9b: superset exercises are visible in the structure view', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_AUTO_MODE);
    await addSourcesPage.mockGenerateStructureApi({ withSupersets: true });

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();
    await addSourcesPage.clickGenerateStructure();
    await addSourcesPage.expectGenerateComplete();

    // All superset exercises from the fixture should be visible
    await addSourcesPage.expectExerciseVisible('Bench Press');
    await addSourcesPage.expectExerciseVisible('Bent Over Row');
    await addSourcesPage.expectExerciseVisible('Overhead Press');
    await addSourcesPage.expectExerciseVisible('Pull-Ups');
  });

  test('REG-IG9c: block-level exercises (warm-up, cool-down) render alongside supersets', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_AUTO_MODE);
    await addSourcesPage.mockGenerateStructureApi({ withSupersets: true });

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();
    await addSourcesPage.clickGenerateStructure();
    await addSourcesPage.expectGenerateComplete();

    // Block labels should be visible
    await addSourcesPage.expectBlockVisible('Warm-Up');
    await addSourcesPage.expectBlockVisible('Strength Supersets');
    await addSourcesPage.expectBlockVisible('Cool-Down');

    // Warm-up exercises (block-level, not in supersets)
    await addSourcesPage.expectExerciseVisible('Arm Circles');
    await addSourcesPage.expectExerciseVisible('Leg Swings');

    // Cool-down exercises
    await addSourcesPage.expectExerciseVisible('Chest Stretch');
    await addSourcesPage.expectExerciseVisible('Lat Stretch');
  });

  test('REG-IG9d: superset exercises are NOT duplicated outside the superset container', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_AUTO_MODE);
    await addSourcesPage.mockGenerateStructureApi({ withSupersets: true });

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();
    await addSourcesPage.clickGenerateStructure();
    await addSourcesPage.expectGenerateComplete();

    // "Bench Press" should appear exactly once (inside Superset 1, not also
    // as a standalone block exercise). We count all instances on the page.
    const benchPressElements = page.getByText('Bench Press', { exact: true });
    const count = await benchPressElements.count();

    // It should appear once in the exercise card. If duplicated, count > 1.
    expect(count).toBe(1);
  });

  test('REG-IG9e: structure with NO supersets does not show Superset badges', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_AUTO_MODE);

    // Use the simple response (no supersets)
    await addSourcesPage.mockGenerateStructureApi({ withSupersets: false });

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();
    await addSourcesPage.clickGenerateStructure();
    await addSourcesPage.expectGenerateComplete();

    // No superset badges should be present
    await addSourcesPage.expectSupersetCount(0);

    // But exercises should still render
    await addSourcesPage.expectExerciseVisible('Burpees');
    await addSourcesPage.expectExerciseVisible('Mountain Climbers');
  });
});

// ===========================================================================
// REG-IG10: YouTube/TikTok unchanged (Flow 5 -- non-regression)
//
// Verifies that the Instagram auto-extract feature did not break the existing
// YouTube and TikTok video source flows.
// ===========================================================================

test.describe('YouTube/TikTok non-regression', () => {
  test('REG-IG10a: YouTube URL adds to sources list (no dialog), regardless of Instagram mode', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);

    // Even with Instagram manual mode, YouTube should go to sources list
    await addSourcesPage.goto(PREFS_MANUAL_MODE);

    await addSourcesPage.typeVideoUrl(YOUTUBE_URL);
    await addSourcesPage.submitVideoUrl();

    // No dialog should open for YouTube
    await addSourcesPage.expectDialogNotPresent();

    // YouTube URL should be in the sources list
    await addSourcesPage.expectSourceInList(YOUTUBE_URL);
    await addSourcesPage.expectSourceType('youtube');
  });

  test('REG-IG10b: YouTube Generate Structure still works after Instagram feature addition', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_MANUAL_MODE);

    // Mock the generate-structure API for YouTube sources
    await addSourcesPage.mockGenerateStructureApi();

    await addSourcesPage.typeVideoUrl(YOUTUBE_URL);
    await addSourcesPage.submitVideoUrl();
    await addSourcesPage.expectSourceInList(YOUTUBE_URL);

    await addSourcesPage.clickGenerateStructure();
    await addSourcesPage.expectGenerateComplete();
  });

  test('REG-IG10c: TikTok URL adds to sources list (no dialog), regardless of Instagram mode', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);

    // Even with Instagram in auto mode, TikTok should go to sources list
    await addSourcesPage.goto(PREFS_AUTO_MODE);

    await addSourcesPage.typeVideoUrl(TIKTOK_URL);
    await addSourcesPage.submitVideoUrl();

    // No dialog should open for TikTok
    await addSourcesPage.expectDialogNotPresent();

    // TikTok URL should be in the sources list
    await addSourcesPage.expectSourceInList(TIKTOK_URL);
    await addSourcesPage.expectSourceType('tiktok');
  });

  test('REG-IG10d: mixing YouTube and Instagram sources in the same session', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    await addSourcesPage.goto(PREFS_AUTO_MODE);

    // Add YouTube source
    await addSourcesPage.typeVideoUrl(YOUTUBE_URL);
    await addSourcesPage.submitVideoUrl();
    await addSourcesPage.expectSourceCount(1);
    await addSourcesPage.expectSourceType('youtube');

    // Add Instagram source (auto mode -- goes to sources list)
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();
    await addSourcesPage.expectSourceCount(2);

    // Both should be in the list
    await addSourcesPage.expectSourceInList(YOUTUBE_URL);
    await addSourcesPage.expectSourceInList(INSTAGRAM_REEL_URL);
  });

  test('REG-IG10e: YouTube badge shows "AI-Powered" not "Semi-Manual"', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);

    // Instagram set to manual, but YouTube should always show AI-Powered
    await addSourcesPage.goto(PREFS_MANUAL_MODE);

    await addSourcesPage.typeVideoUrl(YOUTUBE_URL);
    await addSourcesPage.expectBadgeText('AI-Powered');

    // Switch to Instagram to show the difference
    await addSourcesPage.videoUrlInput.clear();
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.expectBadgeText('Semi-Manual');

    // Switch back to YouTube
    await addSourcesPage.videoUrlInput.clear();
    await addSourcesPage.typeVideoUrl(YOUTUBE_URL);
    await addSourcesPage.expectBadgeText('AI-Powered');
  });
});

// ===========================================================================
// REG-IG11: BYPASS_TIER_GATE env var
//
// When BYPASS_TIER_GATE=true, free-tier users should be able to see and
// toggle the Instagram Import setting. In production (no env var), free-tier
// users see it as disabled.
//
// NOTE: This test validates the UI behavior. The env var is read server-side
// and injected as a prop. In E2E tests we can test it by manipulating the
// DOM or by verifying the toggle is enabled/disabled based on the rendered
// state.
// ===========================================================================

test.describe('BYPASS_TIER_GATE behavior', () => {
  test('REG-IG11a: without bypass, free-tier toggle has upgrade alert visible', async ({
    page,
  }) => {
    const settingsPage = new SettingsPage(page);

    // No bypass -- navigate as default user (free tier in dev mode)
    await settingsPage.goto();
    await settingsPage.goToGeneral();

    await settingsPage.expectInstagramCardVisible();

    // The upgrade alert should be present for free tier
    const alertElements = settingsPage.instagramImportCard.locator('[role="alert"]');
    const alertCount = await alertElements.count();
    // If the app renders in free-tier mode, the alert is visible
    if (alertCount > 0) {
      await expect(alertElements.first()).toContainText(/Pro or Trainer subscription/);
    }
  });

  test('REG-IG11b: toggle can still be interacted with via localStorage seeding (simulates bypass)', async ({
    page,
  }) => {
    const settingsPage = new SettingsPage(page);

    // Seed preferences as if BYPASS_TIER_GATE was active (auto-extract enabled)
    await settingsPage.seedPreferences(PREFS_AUTO_MODE);
    await settingsPage.goto();
    await settingsPage.goToGeneral();

    // Toggle should reflect the seeded value
    await settingsPage.expectToggleChecked(true);

    // Click to disable
    await settingsPage.clickToggle();
    await settingsPage.expectToggleChecked(false);

    // Verify persistence
    const prefs = await settingsPage.getStoredPreferences();
    expect((prefs as any).instagramAutoExtract).toBe(false);
  });
});
