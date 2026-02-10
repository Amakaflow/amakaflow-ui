/**
 * Page Object for the AddSources / Video Ingest flow.
 *
 * Encapsulates selectors and common operations for:
 * - The AddSources component (Video tab URL input + platform badges)
 * - The VideoIngestDialog (manual entry vs auto-extraction flow)
 *
 * Used by AMA-565 Instagram Apify E2E tests.
 */

import { Page, Locator, expect } from '@playwright/test';
import {
  PREFERENCES_KEY,
  PREFS_MANUAL_MODE,
  PREFS_AUTO_MODE,
  CACHE_MISS_RESPONSE,
  DETECT_INSTAGRAM_RESPONSE,
  OEMBED_INSTAGRAM_SUCCESS,
  OEMBED_INSTAGRAM_FAILURE,
  APIFY_INGEST_SUCCESS,
  APIFY_INGEST_FAILURE,
  CREATE_FOLLOW_ALONG_SUCCESS,
  INSTAGRAM_REEL_URL,
} from '../fixtures/instagram-apify.fixtures';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MockApiOptions {
  /** If true, the Apify ingest endpoint returns a failure. */
  apifyFails?: boolean;
  /** If true, oEmbed returns a failure (common for Instagram). */
  oembedFails?: boolean;
  /** If true, cache returns a hit. */
  cacheHit?: boolean;
  /** Custom Apify response body. */
  apifyResponse?: object;
  /** Delay (ms) on Apify ingest response to test loading states. */
  apifyDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Page Object
// ---------------------------------------------------------------------------

export class AddSourcesPage {
  readonly page: Page;

  // Video tab elements
  readonly videoTabButton: Locator;
  readonly videoUrlInput: Locator;
  readonly addSourceButton: Locator;

  // Platform detection info area (in VideoInputSection)
  readonly platformInfoBadge: Locator;
  readonly platformSteps: Locator;

  // VideoIngestDialog
  readonly videoIngestDialog: Locator;
  readonly dialogTitle: Locator;
  readonly dialogUrlInput: Locator;
  readonly dialogContinueButton: Locator;
  readonly dialogExtractingSpinner: Locator;
  readonly dialogManualEntryTitle: Locator;
  readonly dialogWorkoutTitleInput: Locator;
  readonly dialogSaveButton: Locator;

  // Toast
  readonly toastContainer: Locator;

  constructor(page: Page) {
    this.page = page;

    // Video tab in AddSources
    this.videoTabButton = page.getByRole('tab', { name: /Video/i });
    this.videoUrlInput = page.getByPlaceholder(
      /Paste YouTube, TikTok, Instagram, or Pinterest URL/
    );
    this.addSourceButton = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });

    // Platform info badge -- the Badge component inside the platform info area
    this.platformInfoBadge = page
      .locator('.bg-muted\\/50.rounded-lg.border')
      .first()
      .locator('[class*="Badge"]');

    // Platform steps text
    this.platformSteps = page.locator('.text-xs.text-muted-foreground').filter({
      hasText: /Step 1:/,
    });

    // VideoIngestDialog (Radix Dialog)
    this.videoIngestDialog = page.getByRole('dialog');
    this.dialogTitle = this.videoIngestDialog.getByText('Add Video Workout');
    this.dialogUrlInput = this.videoIngestDialog.getByPlaceholder(
      /instagram.com\/reel/
    );
    this.dialogContinueButton = this.videoIngestDialog.getByRole('button', {
      name: 'Continue',
    });
    this.dialogExtractingSpinner = this.videoIngestDialog.getByText(
      'Extracting workout with AI...'
    );
    this.dialogManualEntryTitle = this.videoIngestDialog.getByText(
      'Add exercises manually for this Instagram video'
    );
    this.dialogWorkoutTitleInput = this.videoIngestDialog.getByPlaceholder(
      '10-Minute Core Workout'
    );
    this.dialogSaveButton = this.videoIngestDialog.getByRole('button', {
      name: 'Save Workout',
    });

    // Sonner toast
    this.toastContainer = page.locator('[data-sonner-toaster]');
  }

  // =========================================================================
  // API Mocking
  // =========================================================================

  /**
   * Set up all API route mocks needed for the Instagram ingest flow.
   *
   * Intercepts:
   * - POST /video/detect          (platform detection)
   * - POST /video/oembed          (oEmbed metadata)
   * - POST /video/cache/check     (cache lookup)
   * - POST /ingest/instagram_reel (Apify extraction)
   * - POST /follow-along/manual   (save manual workout)
   */
  async mockIngestApis(options: MockApiOptions = {}) {
    const {
      apifyFails = false,
      oembedFails = false,
      cacheHit = false,
      apifyResponse = APIFY_INGEST_SUCCESS,
      apifyDelayMs = 0,
    } = options;

    // Mock video/detect
    await this.page.route('**/video/detect', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(DETECT_INSTAGRAM_RESPONSE),
      });
    });

    // Mock video/cache/check
    await this.page.route('**/video/cache/check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CACHE_MISS_RESPONSE),
      });
    });

    // Mock video/oembed
    await this.page.route('**/video/oembed', async (route) => {
      await route.fulfill({
        status: oembedFails ? 401 : 200,
        contentType: 'application/json',
        body: JSON.stringify(
          oembedFails ? OEMBED_INSTAGRAM_FAILURE : OEMBED_INSTAGRAM_SUCCESS
        ),
      });
    });

    // Mock ingest/instagram_reel (Apify)
    await this.page.route('**/ingest/instagram_reel', async (route) => {
      if (apifyDelayMs > 0) {
        await new Promise((r) => setTimeout(r, apifyDelayMs));
      }
      if (apifyFails) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify(APIFY_INGEST_FAILURE),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(apifyResponse),
        });
      }
    });

    // Mock follow-along manual create
    await this.page.route('**/follow-along/manual', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CREATE_FOLLOW_ALONG_SUCCESS),
      });
    });

    // Mock video/cache/save (non-blocking, always succeed)
    await this.page.route('**/video/cache/save', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cached: true, cache_entry: null }),
      });
    });
  }

  // =========================================================================
  // localStorage Helpers
  // =========================================================================

  /**
   * Seed localStorage preferences. Must be called after at least one
   * page.goto() to establish the origin context.
   */
  async seedPreferences(prefs: Record<string, unknown>) {
    await this.page.evaluate(
      ([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
      },
      [PREFERENCES_KEY, prefs] as const
    );
  }

  // =========================================================================
  // Navigation
  // =========================================================================

  /**
   * Navigate to the main app page where AddSources is rendered.
   * Seeds preferences first if provided.
   */
  async goto(prefs?: Record<string, unknown>) {
    await this.page.goto('/');
    if (prefs) {
      await this.seedPreferences(prefs);
      await this.page.reload();
    }
  }

  // =========================================================================
  // Video Tab Interactions
  // =========================================================================

  /**
   * Ensure the Video tab is active and type a URL into the input field.
   */
  async typeVideoUrl(url: string) {
    // Ensure Video tab is active
    await this.videoTabButton.click();
    await this.videoUrlInput.fill(url);
  }

  /**
   * Submit the video URL by clicking the Add (+) button.
   */
  async submitVideoUrl() {
    // Find the Plus button adjacent to the URL input
    const plusButton = this.page
      .locator('.flex.gap-2')
      .filter({ has: this.videoUrlInput })
      .getByRole('button');
    await plusButton.click();
  }

  // =========================================================================
  // Badge Assertions (AddSources platform info)
  // =========================================================================

  /**
   * Assert that the platform badge shows the expected text.
   */
  async expectBadgeText(text: string | RegExp) {
    // The badge is inside the platform detection area
    const badge = this.page.locator('[class*="Badge"]').filter({ hasText: text });
    await expect(badge.first()).toBeVisible({ timeout: 5_000 });
  }

  /**
   * Assert that the platform steps match the expected extraction method.
   */
  async expectStepText(stepText: string | RegExp) {
    const stepElement = this.page.locator('.text-xs').filter({ hasText: stepText });
    await expect(stepElement.first()).toBeVisible();
  }

  /**
   * Assert the platform method description is visible.
   */
  async expectMethodText(text: string | RegExp) {
    await expect(
      this.page.locator('.text-sm.font-medium').filter({ hasText: text })
    ).toBeVisible();
  }

  // =========================================================================
  // VideoIngestDialog Assertions
  // =========================================================================

  /**
   * Wait for the VideoIngestDialog to open.
   */
  async expectDialogOpen() {
    await expect(this.videoIngestDialog).toBeVisible({ timeout: 5_000 });
    await expect(this.dialogTitle).toBeVisible();
  }

  /**
   * Assert the dialog shows the extracting/AI step.
   */
  async expectExtractingStep() {
    await expect(this.dialogExtractingSpinner).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Assert the dialog shows the manual entry step.
   */
  async expectManualEntryStep() {
    await expect(this.dialogManualEntryTitle).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Assert the dialog is closed (not visible).
   */
  async expectDialogClosed() {
    await expect(this.videoIngestDialog).toBeHidden({ timeout: 10_000 });
  }

  // =========================================================================
  // Toast Assertions
  // =========================================================================

  async expectToastWithText(textPattern: string | RegExp) {
    const toast = this.page.locator('[data-sonner-toast]').filter({
      hasText: textPattern,
    });
    await expect(toast.first()).toBeVisible({ timeout: 5_000 });
  }
}
