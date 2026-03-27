/**
 * UX Improvements Batch - Screenshot tests
 * Takes screenshots in both dark and light mode for all improved screens.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3099';
const SCREENSHOT_DIR = 'e2e/screenshots';

async function setTheme(page: any, theme: 'dark' | 'light') {
  await page.evaluate((t: string) => {
    localStorage.setItem('amakaflow-theme', t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, theme);
  // Give CSS a moment to repaint
  await page.waitForTimeout(300);
}

test.describe('UX Improvements Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // AMA-1173: Top Nav redesign
  test('AMA-1173: NavBar with dropdown grouping - dark', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.waitForLoadState('networkidle');
    await setTheme(page, 'dark');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ama-1173-navbar-dark.png`, fullPage: false });
  });

  test('AMA-1173: NavBar with dropdown grouping - light', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.waitForLoadState('networkidle');
    await setTheme(page, 'light');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ama-1173-navbar-light.png`, fullPage: false });
  });

  // AMA-1174: Calendar with demo data
  test('AMA-1174: Calendar with TrainingWeekView - dark', async ({ page }) => {
    await page.goto(BASE + '/calendar');
    await page.waitForLoadState('networkidle');
    await setTheme(page, 'dark');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ama-1174-calendar-dark.png`, fullPage: false });
  });

  test('AMA-1174: Calendar with TrainingWeekView - light', async ({ page }) => {
    await page.goto(BASE + '/calendar');
    await page.waitForLoadState('networkidle');
    await setTheme(page, 'light');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ama-1174-calendar-light.png`, fullPage: false });
  });

  // AMA-1175: Settings collapsible sections
  test('AMA-1175: Settings grouped sections - dark', async ({ page }) => {
    await page.goto(BASE + '/settings');
    await page.waitForLoadState('networkidle');
    await setTheme(page, 'dark');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ama-1175-settings-dark.png`, fullPage: false });
  });

  test('AMA-1175: Settings grouped sections - light', async ({ page }) => {
    await page.goto(BASE + '/settings');
    await page.waitForLoadState('networkidle');
    await setTheme(page, 'light');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ama-1175-settings-light.png`, fullPage: false });
  });

  // AMA-1176: Export empty state
  test('AMA-1176: Export empty state - dark', async ({ page }) => {
    await page.goto(BASE + '/export');
    await page.waitForLoadState('networkidle');
    await setTheme(page, 'dark');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ama-1176-export-empty-dark.png`, fullPage: false });
  });

  test('AMA-1176: Export empty state - light', async ({ page }) => {
    await page.goto(BASE + '/export');
    await page.waitForLoadState('networkidle');
    await setTheme(page, 'light');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ama-1176-export-empty-light.png`, fullPage: false });
  });

  // AMA-1177: My Workouts enhanced card
  test('AMA-1177: My Workouts enhanced cards - dark', async ({ page }) => {
    await page.goto(BASE + '/workouts');
    await page.waitForLoadState('networkidle');
    await setTheme(page, 'dark');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ama-1177-workouts-dark.png`, fullPage: false });
  });

  test('AMA-1177: My Workouts enhanced cards - light', async ({ page }) => {
    await page.goto(BASE + '/workouts');
    await page.waitForLoadState('networkidle');
    await setTheme(page, 'light');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ama-1177-workouts-light.png`, fullPage: false });
  });

  // AMA-1179: Theme toggle in settings
  test('AMA-1179: Theme toggle - dark', async ({ page }) => {
    await page.goto(BASE + '/settings');
    await page.waitForLoadState('networkidle');
    await setTheme(page, 'dark');
    // Navigate to Appearance section
    const appearanceBtn = page.locator('text=Appearance');
    if (await appearanceBtn.isVisible()) {
      await appearanceBtn.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ama-1179-theme-toggle-dark.png`, fullPage: false });
  });

  test('AMA-1179: Theme toggle - light', async ({ page }) => {
    await page.goto(BASE + '/settings');
    await page.waitForLoadState('networkidle');
    await setTheme(page, 'light');
    // Navigate to Appearance section
    const appearanceBtn = page.locator('text=Appearance');
    if (await appearanceBtn.isVisible()) {
      await appearanceBtn.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ama-1179-theme-toggle-light.png`, fullPage: false });
  });
});
