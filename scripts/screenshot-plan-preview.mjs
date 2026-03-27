/**
 * AMA-1128: Take screenshots of plan preview components.
 * Run: node scripts/screenshot-plan-preview.mjs
 * Requires dev server running on localhost:5199.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5199';

async function main() {
  const browser = await chromium.launch({ headless: true });

  // 1. Before generate — full training week view
  console.log('1. Before generate...');
  const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const p1 = await ctx1.newPage();
  p1.on('console', msg => { if (msg.type() === 'error') console.log('  CONSOLE ERROR:', msg.text()); });
  await p1.goto(`${BASE}/plan-preview.html`, { waitUntil: 'networkidle' });
  await p1.click('[data-testid="tab-full"]');
  await p1.waitForSelector('[data-testid="training-week-view"]');
  await p1.waitForTimeout(500);
  await p1.screenshot({ path: '/tmp/ama-1128-before-generate.png', fullPage: true });
  console.log('  -> /tmp/ama-1128-before-generate.png');

  // 2. Preview overlay after generate
  console.log('2. Preview overlay after generate...');
  await p1.click('[data-testid="generate-week-btn"]');
  await p1.waitForSelector('[data-testid="plan-preview-overlay"]', { timeout: 10000 });
  await p1.waitForTimeout(500);
  await p1.screenshot({ path: '/tmp/ama-1128-preview-overlay.png', fullPage: true });
  console.log('  -> /tmp/ama-1128-preview-overlay.png');
  await ctx1.close();

  // 3. Summary panel standalone
  console.log('3. Summary panel...');
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/plan-preview.html`, { waitUntil: 'networkidle' });
  await p2.click('[data-testid="tab-summary-only"]');
  await p2.waitForSelector('[data-testid="plan-summary"]');
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: '/tmp/ama-1128-summary-panel.png', fullPage: true });
  console.log('  -> /tmp/ama-1128-summary-panel.png');
  await ctx2.close();

  // 4. Mobile view of overlay
  console.log('4. Mobile view...');
  const ctx3 = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: 'dark' });
  const p3 = await ctx3.newPage();
  await p3.goto(`${BASE}/plan-preview.html`, { waitUntil: 'networkidle' });
  await p3.click('[data-testid="tab-overlay-only"]');
  await p3.waitForSelector('[data-testid="plan-preview-overlay"]');
  await p3.waitForTimeout(300);
  await p3.screenshot({ path: '/tmp/ama-1128-mobile-view.png', fullPage: true });
  console.log('  -> /tmp/ama-1128-mobile-view.png');
  await ctx3.close();

  await browser.close();
  console.log('\nAll 4 screenshots saved to /tmp/ama-1128-*.png');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
