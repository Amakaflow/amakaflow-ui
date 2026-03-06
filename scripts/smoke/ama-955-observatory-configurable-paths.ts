// scripts/smoke/ama-955-observatory-configurable-paths.ts
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE_URL = process.env.SMOKE_URL ?? 'http://localhost:3015';
const HEADLESS = process.env.HEADLESS === '1';

await mkdir('/tmp/smoke', { recursive: true });
const browser = await chromium.launch({ headless: HEADLESS });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 820 });

try {
  // Frame 1: Page loads with palette and preset picker
  await page.goto(`${BASE_URL}/pipeline.html`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('text=Step Palette', { timeout: 5000 });
  await page.waitForSelector('text=YouTube', { timeout: 5000 });
  await page.screenshot({ path: '/tmp/smoke/frame-1-loaded.png' });
  console.log('Frame 1: Palette visible with YouTube step');

  // Frame 2: Select "Everything" preset — parallel group appears
  // The preset picker is a <select> in the controls bar
  await page.selectOption('.flex.items-center.gap-3 select:first-child', { label: /everything/i });
  await page.waitForSelector('text=Parallel export', { timeout: 3000 });
  await page.screenshot({ path: '/tmp/smoke/frame-2-preset-everything.png' });
  console.log('Frame 2: Everything preset shows parallel group');

  // Frame 3: Collapse palette — icon rail visible, "Step Palette" label hidden
  await page.click('button[aria-label="collapse palette"]');
  await page.waitForTimeout(350); // animation
  const paletteLabel = await page.$('text=Step Palette');
  if (paletteLabel) throw new Error('Palette label should be hidden when collapsed');
  await page.screenshot({ path: '/tmp/smoke/frame-3-palette-collapsed.png' });
  console.log('Frame 3: Palette collapsed to icon rail');

  // Frame 4: Expand palette again and add a step from palette
  await page.click('button[aria-label="expand palette"]');
  await page.waitForTimeout(350);
  await page.waitForSelector('text=Step Palette', { timeout: 3000 });
  // Click "Map Exercises" step in palette to add to canvas
  const mapButton = page.locator('button', { hasText: 'Map Exercises' }).first();
  await mapButton.click();
  await page.screenshot({ path: '/tmp/smoke/frame-4-step-added.png' });
  console.log('Frame 4: Step added from palette to canvas');

} finally {
  await browser.close();
}
console.log('Smoke complete. Screenshots in /tmp/smoke/');
