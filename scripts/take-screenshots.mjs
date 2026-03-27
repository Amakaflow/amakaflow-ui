/**
 * Take screenshots of the TrainingWeekView for AMA-1126.
 * Run: node scripts/take-screenshots.mjs
 * Requires dev server running on localhost:3000.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PREVIEW_URL = `${BASE}/training-week-preview.html`;

async function main() {
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop full week view
  console.log('1. Desktop full week view...');
  const d1 = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  const p1 = await d1.newPage();

  // Listen for console errors
  p1.on('console', msg => {
    if (msg.type() === 'error') console.log('  CONSOLE ERROR:', msg.text());
  });
  p1.on('pageerror', err => console.log('  PAGE ERROR:', err.message));

  await p1.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
  await p1.waitForTimeout(2000);

  // Debug: check what's on the page
  const bodyHTML = await p1.evaluate(() => document.body.innerHTML.substring(0, 500));
  console.log('  Body HTML:', bodyHTML);

  await p1.screenshot({ path: '/tmp/ama-1126-desktop-week-view.png', fullPage: true });
  console.log('  -> /tmp/ama-1126-desktop-week-view.png');

  // 2. Click "Details" to expand first session
  console.log('2. Expanded session view...');
  const detailsBtns = await p1.getByText('Details').all();
  console.log('  Found Details buttons:', detailsBtns.length);
  if (detailsBtns.length > 0) {
    await detailsBtns[0].click();
    await p1.waitForTimeout(500);
  }
  await p1.screenshot({ path: '/tmp/ama-1126-desktop-expanded-session.png', fullPage: true });
  console.log('  -> /tmp/ama-1126-desktop-expanded-session.png');

  // 3. Toggle to Actuals view
  console.log('3. Plan vs Actual toggle (Actuals view)...');
  const switchEl = p1.locator('[role="switch"]');
  if (await switchEl.isVisible()) {
    await switchEl.click();
    await p1.waitForTimeout(500);
  }
  await p1.screenshot({ path: '/tmp/ama-1126-desktop-actuals-view.png', fullPage: true });
  console.log('  -> /tmp/ama-1126-desktop-actuals-view.png');

  // Toggle back to planned
  if (await switchEl.isVisible()) {
    await switchEl.click();
    await p1.waitForTimeout(500);
  }

  await d1.close();

  // 4. Mobile view
  console.log('4. Mobile view...');
  const d2 = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: 'dark' });
  const p2 = await d2.newPage();
  await p2.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
  await p2.waitForTimeout(2000);
  await p2.screenshot({ path: '/tmp/ama-1126-mobile-week-view.png', fullPage: true });
  console.log('  -> /tmp/ama-1126-mobile-week-view.png');

  // 5. Mobile expanded session
  console.log('5. Mobile expanded session...');
  const mobileDetails = await p2.getByText('Details').all();
  if (mobileDetails.length > 0) {
    await mobileDetails[0].click();
    await p2.waitForTimeout(500);
  }
  await p2.screenshot({ path: '/tmp/ama-1126-mobile-expanded.png', fullPage: true });
  console.log('  -> /tmp/ama-1126-mobile-expanded.png');

  // 6. Mobile actuals view
  console.log('6. Mobile actuals view...');
  const mobileSwitchEl = p2.locator('[role="switch"]');
  if (await mobileSwitchEl.isVisible()) {
    await mobileSwitchEl.click();
    await p2.waitForTimeout(500);
  }
  await p2.screenshot({ path: '/tmp/ama-1126-mobile-actuals.png', fullPage: true });
  console.log('  -> /tmp/ama-1126-mobile-actuals.png');

  await d2.close();

  // 7. Tablet view
  console.log('7. Tablet view...');
  const d3 = await browser.newContext({ viewport: { width: 768, height: 1024 }, colorScheme: 'dark' });
  const p3 = await d3.newPage();
  await p3.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
  await p3.waitForTimeout(2000);
  await p3.screenshot({ path: '/tmp/ama-1126-tablet-week-view.png', fullPage: true });
  console.log('  -> /tmp/ama-1126-tablet-week-view.png');
  await d3.close();

  await browser.close();
  console.log('\nAll screenshots saved to /tmp/ama-1126-*.png');
}

main().catch(console.error);
