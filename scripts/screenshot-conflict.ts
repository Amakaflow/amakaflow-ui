/**
 * Take screenshots of the AMA-1118 conflict detection UI.
 *
 * Usage: npx tsx scripts/screenshot-conflict.ts
 *
 * Requires the dev server to be running (npm run dev).
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch();

  // --- Full conflict preview page ---
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  console.log('Navigating to conflict preview...');
  await page.goto(`${BASE}/conflict-preview.html`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Screenshot 1: full page overview
  await page.screenshot({ path: '/tmp/ama-1118-overview.png', fullPage: true });
  console.log('Saved /tmp/ama-1118-overview.png');

  // Screenshot 2: expand the first conflict card
  const firstToggle = page.locator('[data-testid="conflict-toggle-same_muscle_group"]').first();
  if (await firstToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstToggle.click();
    await page.waitForTimeout(500);
  }

  // Also expand the critical one
  const criticalToggle = page.locator('[data-testid="conflict-toggle-pre_fatigue"]').first();
  if (await criticalToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
    await criticalToggle.click();
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: '/tmp/ama-1118-expanded.png', fullPage: true });
  console.log('Saved /tmp/ama-1118-expanded.png');

  // Screenshot 3: training week with conflicts
  // Scroll to the TrainingWeekView section and click generate
  const generateBtn = page.locator('[data-testid="generate-week-btn"]');
  if (await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await generateBtn.scrollIntoViewIfNeeded();
    await generateBtn.click();
    // Wait for generation to complete
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: '/tmp/ama-1118-week-view.png', fullPage: true });
  console.log('Saved /tmp/ama-1118-week-view.png');

  await ctx.close();
  await browser.close();
  console.log('Done!');
}

main().catch(console.error);
