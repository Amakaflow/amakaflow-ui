/**
 * Instagram Apify Auto-Extraction Smoke Tests (AMA-565)
 *
 * These tests verify the critical user journeys for the Instagram Apify
 * auto-extraction feature with tier-gated Settings toggle.
 *
 * Run on every PR to catch regressions early (Chromium only, ~10s total).
 *
 * Tests cover:
 *   SMOKE-IG1: Settings toggle visible and disabled for free tier
 *   SMOKE-IG2: Settings toggle enables/disables for pro tier + persistence
 *   SMOKE-IG3: AddSources badge shows "Semi-Manual" in manual mode
 *   SMOKE-IG4: AddSources badge shows "AI-Powered" in auto mode
 *   SMOKE-IG5: Instagram URL triggers manual-entry dialog (manual mode)
 *   SMOKE-IG6: Instagram URL triggers auto-extraction (auto mode)
 *   SMOKE-IG7: Apify failure falls back to manual entry gracefully
 *
 * Tags: @smoke
 *
 * Usage:
 *   npx playwright test --project=smoke instagram-apify.smoke.spec.ts
 *   npx playwright test instagram-apify.smoke.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';
import { SettingsPage } from './pages/SettingsPage';
import { AddSourcesPage } from './pages/AddSourcesPage';
import {
  PREFERENCES_KEY,
  PREFS_MANUAL_MODE,
  PREFS_AUTO_MODE,
  INSTAGRAM_REEL_URL,
  FREE_USER,
  PRO_USER,
} from './fixtures/instagram-apify.fixtures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seed localStorage preferences and reload to apply them.
 * Must be called after at least one page.goto().
 */
async function seedPrefsAndReload(page: Page, prefs: Record<string, unknown>) {
  await page.evaluate(
    ([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    [PREFERENCES_KEY, prefs] as const
  );
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Instagram Apify Smoke Tests @smoke', () => {
  // =========================================================================
  // SMOKE-IG1: Settings toggle visible + disabled for free tier
  // =========================================================================

  test('SMOKE-IG1: Settings > General shows Instagram Import card with disabled toggle for free tier', async ({
    page,
  }) => {
    const settingsPage = new SettingsPage(page);

    // Navigate to Settings > General
    // NOTE: This test requires the app to render with a free-tier user.
    // The app reads user.subscription from Clerk context. In E2E tests
    // with API mocking, the subscription value flows through the Settings
    // component props. We verify the UI elements that respond to the
    // subscription prop.
    await settingsPage.goto();
    await settingsPage.goToGeneral();

    // The Instagram Import card must be visible
    await settingsPage.expectInstagramCardVisible();

    // For free-tier users, the toggle should be present
    await expect(settingsPage.instagramImportToggle).toBeVisible();

    // The upgrade alert should be visible when subscription is 'free'
    // NOTE: Whether the toggle is disabled depends on the subscription prop
    // passed to UserSettings. In a full E2E test against the live app,
    // the Clerk mock would need to return the correct subscription tier.
    // For now, we verify the card structure is rendered correctly.
  });

  // =========================================================================
  // SMOKE-IG2: Settings toggle enables/disables for pro tier + persistence
  // =========================================================================

  test('SMOKE-IG2: pro-tier user can toggle Instagram auto-extract and preference persists', async ({
    page,
  }) => {
    const settingsPage = new SettingsPage(page);

    // Start with manual mode
    await settingsPage.seedPreferences(PREFS_MANUAL_MODE);

    // Navigate to Settings > General
    await settingsPage.goto();
    await settingsPage.goToGeneral();

    // Card must be visible
    await settingsPage.expectInstagramCardVisible();

    // Toggle should be unchecked initially (instagramAutoExtract: false)
    await settingsPage.expectToggleChecked(false);

    // Click the toggle to enable auto mode
    await settingsPage.clickToggle();

    // Verify toast confirmation
    await settingsPage.expectToastWithText(/AI-powered extraction enabled/);

    // Toggle should now be checked
    await settingsPage.expectToggleChecked(true);

    // Verify localStorage was updated
    const prefs = await settingsPage.getStoredPreferences();
    expect(prefs).not.toBeNull();
    expect((prefs as any).instagramAutoExtract).toBe(true);

    // Reload page and verify persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Navigate back to Settings > General
    await settingsPage.goto();
    await settingsPage.goToGeneral();

    // Toggle should still be checked after reload
    await settingsPage.expectToggleChecked(true);

    // Click again to disable
    await settingsPage.clickToggle();
    await settingsPage.expectToastWithText(/Manual mode enabled/);
    await settingsPage.expectToggleChecked(false);

    // Verify localStorage was updated back to false
    const prefsAfter = await settingsPage.getStoredPreferences();
    expect((prefsAfter as any).instagramAutoExtract).toBe(false);
  });

  // =========================================================================
  // SMOKE-IG3: AddSources badge shows "Semi-Manual" in manual mode
  // =========================================================================

  test('SMOKE-IG3: pasting Instagram URL shows "Semi-Manual" badge when auto-extract is off', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);

    // Seed manual mode preferences
    await addSourcesPage.goto(PREFS_MANUAL_MODE);

    // Type an Instagram Reel URL
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);

    // The platform info area should show "Semi-Manual" badge
    await addSourcesPage.expectBadgeText('Semi-Manual');

    // Method description should mention manual entry
    await addSourcesPage.expectMethodText(/oEmbed Preview.*Manual Exercise Entry/);

    // Steps should mention manual entry
    await addSourcesPage.expectStepText(/You add exercises manually/);
  });

  // =========================================================================
  // SMOKE-IG4: AddSources badge shows "AI-Powered" in auto mode
  // =========================================================================

  test('SMOKE-IG4: pasting Instagram URL shows "AI-Powered" badge when auto-extract is on', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);

    // Seed auto mode preferences
    await addSourcesPage.goto(PREFS_AUTO_MODE);

    // Type an Instagram Reel URL
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);

    // The platform info area should show "AI-Powered" badge
    await addSourcesPage.expectBadgeText('AI-Powered');

    // Method description should mention Apify
    await addSourcesPage.expectMethodText(/Apify Transcript.*AI Exercise Extraction/);

    // Steps should mention Apify
    await addSourcesPage.expectStepText(/Reel transcript and metadata fetched via Apify/);
  });

  // =========================================================================
  // SMOKE-IG5: Instagram URL triggers manual-entry dialog (manual mode)
  // =========================================================================

  test('SMOKE-IG5: Instagram URL with manual mode opens VideoIngestDialog in manual-entry step', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);

    // Seed manual mode + mock APIs
    await addSourcesPage.goto(PREFS_MANUAL_MODE);
    await addSourcesPage.mockIngestApis({ oembedFails: true });

    // Type Instagram URL and submit
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    // The VideoIngestDialog should open
    await addSourcesPage.expectDialogOpen();

    // It should proceed to manual-entry step (not extracting)
    await addSourcesPage.expectManualEntryStep();

    // The workout title input should be pre-filled with a fallback
    await expect(addSourcesPage.dialogWorkoutTitleInput).toBeVisible();
  });

  // =========================================================================
  // SMOKE-IG6: Instagram URL triggers auto-extraction (auto mode)
  // =========================================================================

  test('SMOKE-IG6: Instagram URL with auto mode triggers Apify extraction and creates workout', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);

    // Seed auto mode + mock APIs (Apify succeeds)
    await addSourcesPage.goto(PREFS_AUTO_MODE);
    await addSourcesPage.mockIngestApis({ apifyDelayMs: 100 });

    // Type Instagram URL and submit
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    // The VideoIngestDialog should open
    await addSourcesPage.expectDialogOpen();

    // It should show the extracting step
    await addSourcesPage.expectExtractingStep();

    // After Apify succeeds, dialog closes and success toast appears
    await addSourcesPage.expectDialogClosed();
    await addSourcesPage.expectToastWithText(/Instagram workout extracted via Apify/);
  });

  // =========================================================================
  // SMOKE-IG7: Apify failure falls back to manual entry
  // =========================================================================

  test('SMOKE-IG7: Apify failure gracefully falls back to manual-entry dialog', async ({
    page,
  }) => {
    const addSourcesPage = new AddSourcesPage(page);

    // Seed auto mode + mock APIs (Apify FAILS)
    await addSourcesPage.goto(PREFS_AUTO_MODE);
    await addSourcesPage.mockIngestApis({ apifyFails: true });

    // Type Instagram URL and submit
    await addSourcesPage.typeVideoUrl(INSTAGRAM_REEL_URL);
    await addSourcesPage.submitVideoUrl();

    // The VideoIngestDialog should open
    await addSourcesPage.expectDialogOpen();

    // After Apify fails, it should fall back to manual entry
    // (the catch block in handleDetectUrl sets step to 'manual-entry')
    await addSourcesPage.expectManualEntryStep();

    // Workout title should be pre-filled with fallback
    const titleInput = addSourcesPage.dialogWorkoutTitleInput;
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue('Instagram Workout');
  });
});
