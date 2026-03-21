/**
 * Playwright screenshot spec for AMA-1128 Plan Preview.
 * Captures: before generate, preview overlay, summary panel, mobile view.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5199';

test.describe('AMA-1128 Plan Preview Screenshots', () => {
  test('before generate - full training week view', async ({ page }) => {
    await page.goto(`${BASE}/plan-preview.html`);
    await page.click('[data-testid="tab-full"]');
    await page.waitForSelector('[data-testid="training-week-view"]');
    await page.screenshot({ path: '/tmp/ama-1128-before-generate.png', fullPage: true });
  });

  test('preview overlay after generate', async ({ page }) => {
    await page.goto(`${BASE}/plan-preview.html`);
    await page.click('[data-testid="tab-full"]');
    await page.waitForSelector('[data-testid="generate-week-btn"]');
    await page.click('[data-testid="generate-week-btn"]');
    // Wait for the generate to finish (1200ms mock delay)
    await page.waitForSelector('[data-testid="plan-preview-overlay"]', { timeout: 5000 });
    await page.screenshot({ path: '/tmp/ama-1128-preview-overlay.png', fullPage: true });
  });

  test('summary panel standalone', async ({ page }) => {
    await page.goto(`${BASE}/plan-preview.html`);
    await page.click('[data-testid="tab-summary-only"]');
    await page.waitForSelector('[data-testid="plan-summary"]');
    await page.screenshot({ path: '/tmp/ama-1128-summary-panel.png', fullPage: true });
  });

  test('mobile view of overlay', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/plan-preview.html`);
    await page.click('[data-testid="tab-overlay-only"]');
    await page.waitForSelector('[data-testid="plan-preview-overlay"]');
    await page.screenshot({ path: '/tmp/ama-1128-mobile-view.png', fullPage: true });
  });
});
