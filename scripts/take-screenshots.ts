/**
 * Standalone screenshot script for UX improvements
 * Run: npx tsx scripts/take-screenshots.ts
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:3099';
const DIR = 'e2e/screenshots';

async function setTheme(page: any, theme: 'dark' | 'light') {
  await page.evaluate((t: string) => {
    localStorage.setItem('amakaflow-theme', t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, theme);
  await page.waitForTimeout(500);
}

async function main() {
  mkdirSync(DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const routes: Array<{ name: string; path: string; clickAfter?: string; wait?: number }> = [
    { name: 'ama-1173-navbar', path: '/' },
    { name: 'ama-1174-calendar', path: '/calendar', wait: 2000 },
    { name: 'ama-1175-settings', path: '/settings', wait: 1000 },
    { name: 'ama-1176-export-empty', path: '/export', wait: 1000 },
    { name: 'ama-1177-workouts', path: '/workouts', wait: 2000 },
    { name: 'ama-1179-theme-toggle', path: '/settings', clickAfter: 'Appearance', wait: 1000 },
  ];

  for (const route of routes) {
    for (const theme of ['dark', 'light'] as const) {
      const page = await context.newPage();
      try {
        // Set theme in localStorage before navigation
        await page.addInitScript((t: string) => {
          localStorage.setItem('amakaflow-theme', t);
        }, theme);

        await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 20000 });
        await setTheme(page, theme);
        await page.waitForTimeout(route.wait || 500);

        if (route.clickAfter) {
          const btn = page.locator(`button:has-text("${route.clickAfter}")`).first();
          if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await btn.click();
            await page.waitForTimeout(500);
          }
        }

        const filePath = `${DIR}/${route.name}-${theme}.png`;
        await page.screenshot({ path: filePath, fullPage: true });
        console.log(`[OK] ${filePath}`);
      } catch (err) {
        console.log(`[WARN] ${route.name}-${theme}: ${(err as Error).message?.substring(0, 100)}`);
      } finally {
        await page.close();
      }
    }
  }

  await browser.close();
  console.log('\nDone. Screenshots saved to', DIR);
}

main().catch(console.error);
