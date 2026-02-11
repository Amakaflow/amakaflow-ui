/**
 * Page Object for the AddSources / Video Ingest flow.
 *
 * Encapsulates selectors and common operations for:
 * - The AddSources component (Video tab URL input + platform badges)
 * - The "Added Sources" list (source cards with icons)
 * - The "Generate Structure" button and loading state
 * - The VideoIngestDialog (manual entry vs auto-extraction flow)
 * - The StructureWorkout view (superset rendering)
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
  GENERATE_STRUCTURE_RESPONSE_WITH_SUPERSETS,
  GENERATE_STRUCTURE_RESPONSE_SIMPLE,
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

export interface MockGenerateOptions {
  /** If true, the generate-structure endpoint returns a failure. */
  fails?: boolean;
  /** Custom response body. */
  response?: object;
  /** Delay (ms) before responding to test loading states. */
  delayMs?: number;
  /** If true, return a response with supersets. */
  withSupersets?: boolean;
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

  // Added Sources list
  readonly addedSourcesCard: Locator;
  readonly addedSourcesList: Locator;

  // Generate Structure button
  readonly generateStructureButton: Locator;

  // VideoIngestDialog
  readonly videoIngestDialog: Locator;
  readonly dialogTitle: Locator;
  readonly dialogUrlInput: Locator;
  readonly dialogContinueButton: Locator;
  readonly dialogExtractingSpinner: Locator;
  readonly dialogManualEntryTitle: Locator;
  readonly dialogWorkoutTitleInput: Locator;
  readonly dialogSaveButton: Locator;

  // StructureWorkout view (post-generate)
  readonly structureView: Locator;

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

    // Added Sources card -- the card that appears when sources are added.
    // Identified by the "Added Sources" title text.
    this.addedSourcesCard = page.locator('[class*="Card"]').filter({
      hasText: /Added Sources/,
    });
    this.addedSourcesList = this.addedSourcesCard.locator('.space-y-2 > div');

    // Generate Structure button
    this.generateStructureButton = page.getByRole('button', {
      name: /Generate Structure/,
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

    // StructureWorkout view -- appears after successful generation.
    // Contains block cards with exercises and supersets.
    this.structureView = page.locator('[class*="Card"]').filter({
      has: page.locator('svg.lucide-grip-vertical'),
    });

    // Sonner toast
    this.toastContainer = page.locator('[data-sonner-toaster]');
  }

  // =========================================================================
  // API Mocking -- VideoIngestDialog flow (manual mode)
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
  // API Mocking -- Generate Structure flow (auto mode)
  // =========================================================================

  /**
   * Set up API route mock for the Generate Structure endpoint.
   *
   * This is the server-side endpoint that processes sources (including
   * Instagram URLs via the Apify pipeline) and returns a structured workout.
   *
   * Intercepts:
   * - POST /generate-structure (or /chat/ SSE endpoint used by the app)
   *
   * The app sends sources to the backend, which processes them and returns
   * a WorkoutStructure. For Instagram auto-extract, the backend calls Apify
   * internally, so the E2E test only needs to mock the final response.
   */
  async mockGenerateStructureApi(options: MockGenerateOptions = {}) {
    const {
      fails = false,
      response,
      delayMs = 50,
      withSupersets = false,
    } = options;

    const responseBody = response
      || (withSupersets
        ? GENERATE_STRUCTURE_RESPONSE_WITH_SUPERSETS
        : GENERATE_STRUCTURE_RESPONSE_SIMPLE);

    // The app may use different endpoints for structure generation.
    // Mock the ingest endpoints that the generate flow calls.
    await this.page.route('**/ingest/**', async (route) => {
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
      if (fails) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Generation failed' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(responseBody),
        });
      }
    });

    // Also mock the video/detect endpoint for URL validation
    await this.page.route('**/video/detect', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(DETECT_INSTAGRAM_RESPONSE),
      });
    });

    // Mock transcript endpoint (used by YouTube/TikTok sources)
    await this.page.route('**/transcript/**', async (route) => {
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseBody),
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
  // Added Sources List Assertions
  // =========================================================================

  /**
   * Assert that a URL appears in the "Added Sources" list.
   */
  async expectSourceInList(url: string) {
    await expect(this.addedSourcesCard).toBeVisible({ timeout: 5_000 });
    const sourceEntry = this.addedSourcesCard.locator('.break-all').filter({
      hasText: url,
    });
    await expect(sourceEntry.first()).toBeVisible({ timeout: 5_000 });
  }

  /**
   * Assert the source count in the "Added Sources" card header.
   */
  async expectSourceCount(count: number) {
    await expect(
      this.addedSourcesCard.getByText(`Added Sources (${count})`)
    ).toBeVisible({ timeout: 5_000 });
  }

  /**
   * Assert that a source with a specific type label exists in the list.
   * The type label is the capitalized platform name shown above the URL.
   */
  async expectSourceType(type: string) {
    const typeLabel = this.addedSourcesCard.locator('.capitalize').filter({
      hasText: new RegExp(type, 'i'),
    });
    await expect(typeLabel.first()).toBeVisible({ timeout: 5_000 });
  }

  /**
   * Assert that the "Added Sources" card is NOT visible (no sources added).
   */
  async expectNoSources() {
    await expect(this.addedSourcesCard).toBeHidden();
  }

  // =========================================================================
  // Generate Structure Assertions
  // =========================================================================

  /**
   * Assert that the "Generate Structure" button is visible and enabled.
   */
  async expectGenerateButtonEnabled() {
    await expect(this.generateStructureButton).toBeVisible();
    await expect(this.generateStructureButton).toBeEnabled();
  }

  /**
   * Assert that the "Generate Structure" button is disabled.
   */
  async expectGenerateButtonDisabled() {
    await expect(this.generateStructureButton).toBeVisible();
    await expect(this.generateStructureButton).toBeDisabled();
  }

  /**
   * Click the "Generate Structure" button.
   */
  async clickGenerateStructure() {
    await this.generateStructureButton.click();
  }

  /**
   * Wait for the structure generation to complete.
   * The loading spinner should disappear and either the structure view
   * appears or a toast is shown.
   */
  async expectGenerateComplete() {
    // The button shows a Loader2 spinner during generation.
    // Wait for either: the spinner to disappear, or a toast to appear.
    await expect(
      this.page.locator('button').filter({ hasText: /Generating Structure/ })
    ).toBeHidden({ timeout: 30_000 });
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
   * Assert no dialog is present (auto mode should NOT open a dialog).
   */
  async expectDialogNotPresent() {
    // Short timeout: the dialog should never appear, so we only need a brief
    // wait to confirm absence (avoids slowing down the test).
    const dialogCount = await this.videoIngestDialog.count();
    expect(dialogCount).toBe(0);
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
  // Superset Rendering Assertions (StructureWorkout view)
  // =========================================================================

  /**
   * Assert that a superset badge is visible in the structure view.
   * The StructureWorkout component renders supersets with
   * "Superset N" badges inside blocks.
   */
  async expectSupersetBadgeVisible(supersetNumber: number) {
    const badge = this.page.locator('[class*="Badge"]').filter({
      hasText: `Superset ${supersetNumber}`,
    });
    await expect(badge.first()).toBeVisible({ timeout: 5_000 });
  }

  /**
   * Assert that a specific number of superset groups are rendered.
   */
  async expectSupersetCount(count: number) {
    const supersetBadges = this.page.locator('[class*="Badge"]').filter({
      hasText: /^Superset \d+$/,
    });
    await expect(supersetBadges).toHaveCount(count, { timeout: 5_000 });
  }

  /**
   * Assert that a block with a specific label is visible.
   */
  async expectBlockVisible(label: string) {
    const block = this.page.getByText(label, { exact: false });
    await expect(block.first()).toBeVisible({ timeout: 5_000 });
  }

  /**
   * Assert that an exercise name appears in the structure view.
   */
  async expectExerciseVisible(name: string) {
    const exercise = this.page.getByText(name, { exact: false });
    await expect(exercise.first()).toBeVisible({ timeout: 5_000 });
  }

  /**
   * Assert that a "superset" structure badge appears on a block.
   * This is the block-level structure indicator (e.g., "Superset" in the
   * block header), distinct from the per-superset "Superset N" badges.
   */
  async expectBlockStructureBadge(structureName: string) {
    const badge = this.page.locator('[class*="Badge"]').filter({
      hasText: structureName,
    });
    await expect(badge.first()).toBeVisible({ timeout: 5_000 });
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
