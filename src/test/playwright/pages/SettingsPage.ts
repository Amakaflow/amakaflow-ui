/**
 * Page Object for the Settings page.
 *
 * Encapsulates navigation, selectors, and common operations for the
 * Settings > General section, specifically the Instagram Import card
 * introduced by AMA-565.
 *
 * The app uses a state-based view system (no URL routing), so navigation
 * to Settings is done by clicking the sidebar gear icon, and navigation
 * within Settings is done by clicking sidebar menu items.
 */

import { Page, Locator, expect } from '@playwright/test';
import {
  PREFERENCES_KEY,
  PREFS_MANUAL_MODE,
  PREFS_AUTO_MODE,
  type FREE_USER,
} from '../fixtures/instagram-apify.fixtures';

// ---------------------------------------------------------------------------
// Page Object
// ---------------------------------------------------------------------------

export class SettingsPage {
  readonly page: Page;

  // Settings sidebar navigation
  readonly settingsHeading: Locator;
  readonly generalMenuItem: Locator;

  // Instagram Import card (Settings > General)
  readonly instagramImportCard: Locator;
  readonly instagramImportTitle: Locator;
  readonly instagramImportToggle: Locator;
  readonly instagramImportDescription: Locator;
  readonly instagramUpgradeAlert: Locator;

  // Toast (sonner)
  readonly toastContainer: Locator;

  constructor(page: Page) {
    this.page = page;

    // Settings sidebar
    this.settingsHeading = page.getByRole('heading', { name: 'Settings' });
    this.generalMenuItem = page.getByRole('button', { name: 'General settings' });

    // Instagram Import card -- locate by the card header text
    this.instagramImportCard = page.locator('[class*="Card"]').filter({
      hasText: 'Instagram Import',
    });
    this.instagramImportTitle = this.instagramImportCard.getByText('Instagram Import');
    this.instagramImportToggle = this.instagramImportCard.getByRole('switch');
    this.instagramImportDescription = this.instagramImportCard.getByText(
      /AI-Powered Extraction|Reels are automatically|You add exercises manually/
    );
    this.instagramUpgradeAlert = this.instagramImportCard.locator('[role="alert"]').filter({
      hasText: /Pro or Trainer subscription/,
    });

    // Sonner toast
    this.toastContainer = page.locator('[data-sonner-toaster]');
  }

  // =========================================================================
  // Navigation
  // =========================================================================

  /**
   * Navigate to the Settings page. Clicks the settings/gear button in sidebar.
   * The app does not use URL routing for Settings, so we click the sidebar entry.
   */
  async goto() {
    await this.page.goto('/');
    // The sidebar has a "Settings" button or gear icon
    const settingsButton = this.page.getByRole('button', { name: /Settings/i });
    await settingsButton.click();
    await expect(this.settingsHeading).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Navigate to Settings > General section (the default, but click to be sure).
   */
  async goToGeneral() {
    await this.generalMenuItem.click();
    // Wait for the General settings heading in the content area
    await expect(
      this.page.getByRole('heading', { name: 'General settings' })
    ).toBeVisible({ timeout: 5_000 });
  }

  // =========================================================================
  // localStorage Helpers
  // =========================================================================

  /**
   * Seed localStorage preferences BEFORE navigating, so the app reads them
   * on mount. Must be called before goto() since localStorage is
   * domain-scoped and requires at least one navigation.
   */
  async seedPreferences(prefs: Record<string, unknown>) {
    // Navigate to origin to establish the localStorage domain
    await this.page.goto('/');
    await this.page.evaluate(
      ([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
      },
      [PREFERENCES_KEY, prefs] as const
    );
  }

  /**
   * Read the current preferences from localStorage.
   */
  async getStoredPreferences(): Promise<Record<string, unknown> | null> {
    return this.page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, PREFERENCES_KEY);
  }

  // =========================================================================
  // Instagram Import Card Assertions
  // =========================================================================

  /**
   * Assert that the Instagram Import card is visible on the General settings page.
   */
  async expectInstagramCardVisible() {
    await expect(this.instagramImportCard).toBeVisible();
    await expect(this.instagramImportTitle).toBeVisible();
  }

  /**
   * Assert the toggle is disabled (free tier gating).
   */
  async expectToggleDisabled() {
    await expect(this.instagramImportToggle).toBeDisabled();
  }

  /**
   * Assert the toggle is enabled (pro/trainer tier).
   */
  async expectToggleEnabled() {
    await expect(this.instagramImportToggle).toBeEnabled();
  }

  /**
   * Assert the toggle is in a specific checked state.
   */
  async expectToggleChecked(checked: boolean) {
    if (checked) {
      await expect(this.instagramImportToggle).toBeChecked();
    } else {
      await expect(this.instagramImportToggle).not.toBeChecked();
    }
  }

  /**
   * Assert the upgrade alert is visible (free tier).
   */
  async expectUpgradeAlertVisible() {
    await expect(this.instagramUpgradeAlert).toBeVisible();
  }

  /**
   * Assert the upgrade alert is NOT visible (pro/trainer tier).
   */
  async expectUpgradeAlertHidden() {
    await expect(this.instagramUpgradeAlert).toHaveCount(0);
  }

  /**
   * Click the Instagram Import toggle.
   */
  async clickToggle() {
    await this.instagramImportToggle.click();
  }

  // =========================================================================
  // Toast Assertions
  // =========================================================================

  /**
   * Assert that a toast with specific text appears.
   */
  async expectToastWithText(textPattern: string | RegExp) {
    const toast = this.page.locator('[data-sonner-toast]').filter({
      hasText: textPattern,
    });
    await expect(toast.first()).toBeVisible({ timeout: 5_000 });
  }
}
