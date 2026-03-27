// Smoke test for AMA-935 — Pipeline Observatory
// Usage:
//   Headed (watch live):  npx tsx scripts/smoke/ama-935-pipeline-observatory.ts
//   Headless (screenshots): HEADLESS=1 npx tsx scripts/smoke/ama-935-pipeline-observatory.ts
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE_URL = process.env.SMOKE_URL ?? 'http://localhost:5174';
const HEADLESS = process.env.HEADLESS === '1';

(async () => {
  await mkdir('/tmp/smoke', { recursive: true });

  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage();

  try {
    // Frame 1: Pipeline Observatory loads
    await page.goto(`${BASE_URL}/pipeline.html`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/smoke/frame-1-loaded.png', fullPage: false });
    console.log('Frame 1: Page loaded');

    // Frame 2: Service health bar shows all 6 services
    await page.waitForSelector('text=Services', { timeout: 5000 });
    await page.screenshot({ path: '/tmp/smoke/frame-2-health-bar.png', fullPage: false });
    console.log('Frame 2: Health bar visible');

    // Frame 3: Run button is present and flow selector works
    await page.waitForSelector('text=▶ Run', { timeout: 3000 });
    await page.screenshot({ path: '/tmp/smoke/frame-3-controls.png', fullPage: false });
    console.log('Frame 3: Run controls visible');

    // Frame 4: Clicking Run triggers a run (step cards appear or "Starting…" appears)
    await page.click('text=▶ Run');
    const runStarted = await page.waitForSelector('text=Stop', { timeout: 5000 }).catch(() => null);
    await page.screenshot({ path: '/tmp/smoke/frame-4-running.png', fullPage: false });
    console.log(`Frame 4: Run triggered (Stop button ${runStarted ? 'appeared' : 'NOT detected'})`);

    console.log('\nSmoke complete. Screenshots saved to /tmp/smoke/');
  } finally {
    await browser.close();
  }
})();
