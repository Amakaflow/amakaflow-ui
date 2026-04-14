/**
 * Pages Navigation Smoke Tests
 *
 * Tier 1: Verify every main view renders without crashing.
 * Takes a screenshot of each page for visual regression reference.
 *
 * Tags: @smoke
 *
 * Usage:
 *   npx playwright test --project=smoke pages-navigation.smoke.spec.ts
 *   npm run test:playwright:smoke
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.join(
  process.cwd(),
  'test-results',
  'smoke-screenshots',
);

// Helper: click a nav button by accessible name or text content
async function clickNav(page: Page, label: string) {
  // Try role-based first, then text-based fallback
  const btn = page
    .getByRole('button', { name: label })
    .first()
    .or(page.locator(`button:has-text("${label}")`).first());
  await btn.click({ timeout: 5_000 });
  await page.waitForTimeout(800);
}

// Helper: click a dropdown trigger, then a menu item
async function clickDropdownItem(page: Page, trigger: string, item: string) {
  await clickNav(page, trigger);
  await page.waitForTimeout(300);
  const menuItem = page
    .getByRole('menuitem', { name: item })
    .first()
    .or(page.locator(`[role="menuitem"]:has-text("${item}")`).first());
  await menuItem.click({ timeout: 5_000 });
  await page.waitForTimeout(800);
}

// Helper: take a named screenshot
async function snap(page: Page, name: string) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, `${name}.png`),
    fullPage: true,
  });
}

test.describe('Page Navigation Smoke Tests', { tag: ['@smoke', '@blocker'] }, () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app — dev server is started by playwright.config webServer
    await page.goto('/', { waitUntil: 'networkidle' });
    // Wait for dev-user auto-creation (placeholder Clerk key path)
    await page.waitForTimeout(2000);
    // Verify the app rendered — look for the AmakaFlow brand text
    await expect(
      page.locator('text=AmakaFlow').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('SMOKE-NAV-01: Home page renders', async ({ page }) => {
    // Already on home after beforeEach
    await expect(page.locator('text=AmakaFlow')).toBeVisible();
    await snap(page, 'home');
  });

  test('SMOKE-NAV-02: Calendar view renders', async ({ page }) => {
    await clickNav(page, 'Calendar');
    // Calendar should show some date-related content
    await expect(page.locator('.container').first()).toBeVisible();
    await snap(page, 'calendar');
  });

  test('SMOKE-NAV-03: Workouts view renders', async ({ page }) => {
    await clickNav(page, 'Workouts');
    await expect(page.locator('.container').first()).toBeVisible();
    await snap(page, 'workouts');
  });

  test('SMOKE-NAV-04: Programs view renders', async ({ page }) => {
    await clickDropdownItem(page, 'Training', 'Programs');
    await expect(page.locator('.container').first()).toBeVisible();
    await snap(page, 'programs');
  });

  test('SMOKE-NAV-05: Analytics view renders', async ({ page }) => {
    await clickDropdownItem(page, 'Insights', 'Analytics');
    await expect(page.locator('.container').first()).toBeVisible();
    await snap(page, 'analytics');
  });

  test('SMOKE-NAV-06: Import Workout view renders', async ({ page }) => {
    await clickDropdownItem(page, 'Create', 'Import Workout');
    await expect(page.locator('.container').first()).toBeVisible();
    await snap(page, 'import');
  });

  // SMOKE-NAV-07 (Bulk Import) removed AMA-1557 — no Bulk Import view in nav.
  // SMOKE-NAV-08 (Team) removed AMA-1557 — no Team view; Community→Crews is closest.

  test('SMOKE-NAV-09: Help view renders', async ({ page }) => {
    await clickNav(page, 'Help');
    await expect(page.locator('.container').first()).toBeVisible();
    await snap(page, 'help');
  });

  // SMOKE-NAV-10 (Exercise History) removed AMA-1557 — not in top nav (sub-page).
  // SMOKE-NAV-11 (Volume Analytics) removed AMA-1557 — not in top nav (sub-page).
  // SMOKE-NAV-12 (Strava Enhance) removed AMA-1557 — only renders when
  //   stravaConnected=true; demo mode never satisfies that condition.

  test('SMOKE-NAV-13: Settings view renders', async ({ page }) => {
    // Settings is typically a gear icon or "Settings" text in the nav
    const settingsBtn = page
      .getByRole('button', { name: /settings/i })
      .first()
      .or(page.locator('button:has(svg.lucide-settings)').first());
    await settingsBtn.click({ timeout: 5_000 });
    await page.waitForTimeout(800);
    await expect(page.locator('.container').first()).toBeVisible();
    await snap(page, 'settings');
  });
});
