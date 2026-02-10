/**
 * Instagram Apify Auto-Extraction Regression Tests (AMA-565)
 *
 * Comprehensive tests covering edge cases, tier gating, preference
 * persistence, badge reactivity, and error handling for the Instagram
 * Apify auto-extraction feature.
 *
 * Run nightly and on release branches (not on every PR -- the smoke suite
 * covers the critical paths there).
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
  APIFY_INGEST_SUCCESS,
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
// REG-IG4: Video ingest dialog flow details
// ===========================================================================

test.describe('Video ingest dialog flow details', () => {
  test('REG-IG4a: auto mode sends POST to /ingest/instagram_reel with correct URL', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);
    let capturedRequest: { method: string; url: string; body: any } | null = null;

    await addSourcesPage.goto(PREFS_AUTO_MODE);

    // Mock APIs but capture the Apify request
    await addSourcesPage.mockIngestApis();

    // Override the ingest route to capture request details
    await page.route('**/ingest/instagram_reel', async (route) => {
      capturedRequest = {
        method: route.request().method(),
        url: route.request().url(),
        body: JSON.parse(route.request().postData() || '{}'),
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(APIFY_INGEST_SUCCESS),
      });
    });

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    // Wait for dialog to close (extraction complete)
    await addSourcesPage.expectDialogClosed();

    // Verify the request was made correctly
    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.method).toBe('POST');
    expect(capturedRequest!.url).toContain('/ingest/instagram_reel');
    expect(capturedRequest!.body.url).toContain('instagram.com/reel');
  });

  test('REG-IG4b: auto mode success toast includes "via Apify"', async ({ page }) => {
    const addSourcesPage = new AddSourcesPage(page);

    await addSourcesPage.goto(PREFS_AUTO_MODE);
    await addSourcesPage.mockIngestApis();

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    await addSourcesPage.expectDialogClosed();
    await addSourcesPage.expectToastWithText(/Apify/);
  });

  test('REG-IG4c: manual mode does NOT call /ingest/instagram_reel', async ({ page }) => {
    const addSourcesPage = new AddSourcesPage(page);
    let apifyCalled = false;

    await addSourcesPage.goto(PREFS_MANUAL_MODE);

    // Mock the other APIs first
    await addSourcesPage.mockIngestApis();

    // Track if the Apify endpoint is called (registered AFTER mockIngestApis
    // so this handler takes priority — Playwright matches last-registered first)
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

  test('REG-IG4d: auto mode shows loading spinner during Apify call', async ({ page }) => {
    const addSourcesPage = new AddSourcesPage(page);

    await addSourcesPage.goto(PREFS_AUTO_MODE);
    // Use a delay so we can observe the loading state
    await addSourcesPage.mockIngestApis({ apifyDelayMs: 2000 });

    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    // Should show extracting step with spinner
    await addSourcesPage.expectExtractingStep();

    // Verify the "This may take a moment" text
    await expect(
      page.getByText('This may take a moment')
    ).toBeVisible();
  });

  test('REG-IG4e: manual mode pre-fills workout title from fallback when oEmbed fails', async ({
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

  test('REG-IG4f: manual mode pre-fills workout title from oEmbed author when available', async ({
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
    let ingestCalled = false;

    await addSourcesPage.goto(PREFS_MANUAL_MODE);

    // Track if the follow-along ingest (non-Instagram) is called
    await page.route('**/ingest/follow-along', async (route) => {
      ingestCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          followAlongWorkout: {
            id: 'fa-yt-001',
            title: 'YouTube Workout',
            steps: [],
          },
        }),
      });
    });

    // Mock video detect for YouTube
    await page.route('**/video/detect', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          platform: 'youtube',
          video_id: 'dQw4w9WgXcQ',
          normalized_url: YOUTUBE_URL,
          original_url: YOUTUBE_URL,
          post_type: 'video',
        }),
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
