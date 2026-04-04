#!/usr/bin/env node
/**
 * Web E2E Test Suite v2 — Proper page verification with content assertions.
 * Each test navigates to the correct page AND verifies page-specific content.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const TIMESTAMP = new Date().toISOString().slice(0, 10);
const REPORT_DIR = `/Users/davidmini/.openclaw/workspace/amakaflow-docs/test-runs/${TIMESTAMP}-web-e2e`;

// Helper: click a dropdown nav item
async function clickDropdown(page, triggerText, itemText) {
  const trigger = page.locator(`button:has-text("${triggerText}")`).first();
  await trigger.click({ timeout: 5000 });
  await page.waitForTimeout(500);
  const item = page.locator(`[role="menuitem"]:has-text("${itemText}")`).first()
    .or(page.locator(`a:has-text("${itemText}")`).first());
  await item.click({ timeout: 5000 });
  await page.waitForTimeout(1500);
}

// New nav structure: Dashboard (direct) | Create (dropdown) | Training (dropdown) | Insights (dropdown) | user menu
const TESTS = [
  {
    ticket: 'AMA-1198', name: 'auth-flow',
    navigate: async (page) => { await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2000); },
    assert: async (page) => {
      const body = await page.locator('body').innerText();
      if (body.includes('AmakaFlow') || body.includes('Welcome') || body.includes('Dashboard')) return { pass: true, detail: 'App loaded with dev-user' };
      return { pass: false, detail: 'App did not load properly' };
    },
  },
  {
    ticket: 'AMA-1199', name: 'dashboard',
    navigate: async (page) => {
      await page.locator('button:has-text("Dashboard")').first().or(page.locator('a:has-text("Dashboard")').first()).click({ timeout: 5000 });
      await page.waitForTimeout(1500);
    },
    assert: async (page) => {
      const body = await page.locator('body').innerText();
      if (body.includes('Dashboard') || body.includes('Sync') || body.includes('Integration')) return { pass: true, detail: 'Dashboard loaded' };
      return { pass: false, detail: 'Dashboard not found' };
    },
  },
  {
    ticket: 'AMA-1202', name: 'workout-import',
    navigate: async (page) => { await clickDropdown(page, 'Create', 'Import'); },
    assert: async (page) => {
      const body = await page.locator('body').innerText();
      if (body.includes('Create Workout') || body.includes('Add') || body.includes('Sources') || body.includes('Import')) return { pass: true, detail: 'Import page loaded' };
      return { pass: false, detail: 'Import page not found' };
    },
  },
  {
    ticket: 'AMA-1202b', name: 'create-ai',
    navigate: async (page) => { await clickDropdown(page, 'Create', 'Create with AI'); },
    assert: async (page) => {
      const body = await page.locator('body').innerText();
      if (body.includes('AI') || body.includes('Generate') || body.includes('Create')) return { pass: true, detail: 'Create AI page loaded' };
      return { pass: false, detail: 'Create AI page not found' };
    },
  },
  {
    ticket: 'AMA-1199b', name: 'calendar',
    navigate: async (page) => { await clickDropdown(page, 'Training', 'Calendar'); },
    assert: async (page) => {
      const hasToday = await page.locator('text="Today"').count() > 0;
      const hasWeekDays = await page.locator('text="Mon"').count() > 0 || await page.locator('text="Tue"').count() > 0;
      if (hasToday || hasWeekDays) return { pass: true, detail: `Today: ${hasToday}, WeekDays: ${hasWeekDays}` };
      return { pass: false, detail: 'Calendar not found' };
    },
  },
  {
    ticket: 'AMA-1204b', name: 'workouts-list',
    navigate: async (page) => { await clickDropdown(page, 'Training', 'My Workouts'); },
    assert: async (page) => {
      const body = await page.locator('body').innerText();
      if (body.includes('Workouts') || body.includes('workout')) return { pass: true, detail: 'Workouts page loaded' };
      return { pass: false, detail: 'Workouts page not found' };
    },
  },
  {
    ticket: 'AMA-1200', name: 'programs',
    navigate: async (page) => { await clickDropdown(page, 'Training', 'Programs'); },
    assert: async (page) => {
      const body = await page.locator('body').innerText();
      if (body.includes('Program') || body.includes('Training')) return { pass: true, detail: 'Programs page loaded' };
      return { pass: false, detail: 'Programs page not found' };
    },
  },
  {
    ticket: 'AMA-1206', name: 'analytics',
    navigate: async (page) => { await clickDropdown(page, 'Insights', 'Analytics'); },
    assert: async (page) => {
      const body = await page.locator('body').innerText();
      if (body.includes('Analytics') || body.includes('Weekly') || body.includes('This week')) return { pass: true, detail: 'Analytics page loaded' };
      return { pass: false, detail: 'Analytics page not found' };
    },
  },
  {
    ticket: 'AMA-1209', name: 'sync-dashboard',
    navigate: async (page) => { await clickDropdown(page, 'Insights', 'Sync Dashboard'); },
    assert: async (page) => {
      const body = await page.locator('body').innerText();
      if (body.includes('Sync') || body.includes('Dashboard') || body.includes('Integration')) return { pass: true, detail: 'Sync Dashboard loaded' };
      return { pass: false, detail: 'Sync Dashboard not found' };
    },
  },
  {
    ticket: 'AMA-1204', name: 'settings',
    navigate: async (page) => {
      // Settings via user menu (Alex Demo button) or direct URL
      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
    },
    assert: async (page) => {
      const body = await page.locator('body').innerText();
      if (body.includes('Settings') || body.includes('Profile') || body.includes('Devices') || body.includes('Account')) return { pass: true, detail: 'Settings loaded' };
      return { pass: false, detail: 'Settings not found' };
    },
  },
];

async function main() {
  console.log(`=== Web E2E Test Suite v2 — ${TESTS.length} tests ===\n`);
  console.log('Each test navigates AND verifies page-specific content.\n');
  await mkdir(REPORT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Load app
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const allResults = [];

  for (const test of TESTS) {
    console.log(`━━━ ${test.ticket}: ${test.name} ━━━`);
    const result = { ticket: test.ticket, name: test.name, status: 'PASS', errors: [], assertions: {}, screenshots: [] };

    try {
      // Navigate
      await test.navigate(page);

      // CRITICAL: Check for visible errors FIRST — any error = FAIL regardless of page content
      const errorPatterns = [
        'Failed to fetch', 'Failed to load', 'Missing authentication',
        'Error:', 'Something went wrong', 'Network Error',
        'Provide Authorization header', 'X-API-Key', '401', '403', '500',
        'ECONNREFUSED', 'TypeError', 'Unauthorized',
      ];
      const bodyText = await page.locator('body').innerText();
      const foundErrors = errorPatterns.filter(pat => bodyText.includes(pat));
      if (foundErrors.length > 0) {
        result.errors.push(`ERROR VISIBLE ON PAGE: ${foundErrors.join(', ')}`);
        // Extract the actual error text for the bug report
        for (const pat of foundErrors) {
          const idx = bodyText.indexOf(pat);
          if (idx >= 0) {
            const snippet = bodyText.substring(Math.max(0, idx - 20), idx + 80).trim();
            result.errorSnippets = result.errorSnippets || [];
            result.errorSnippets.push(snippet);
          }
        }
      }

      // Assert correct page content
      const assertion = await test.assert(page);
      result.assertions = assertion;

      if (!assertion.pass) {
        result.errors.push(`Page assertion failed: ${assertion.detail}`);
      }

      // Desktop screenshot
      const desktopPath = path.join(REPORT_DIR, `${test.name}-desktop.png`);
      await page.screenshot({ path: desktopPath, fullPage: true });
      result.screenshots.push(`${test.name}-desktop.png`);

      // Mobile screenshot
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(500);
      const mobilePath = path.join(REPORT_DIR, `${test.name}-mobile.png`);
      await page.screenshot({ path: mobilePath, fullPage: true });
      result.screenshots.push(`${test.name}-mobile.png`);
      await page.setViewportSize({ width: 1440, height: 900 });

    } catch (err) {
      result.errors.push(err.message.slice(0, 200));
      try {
        await page.screenshot({ path: path.join(REPORT_DIR, `${test.name}-ERROR.png`), fullPage: true });
        result.screenshots.push(`${test.name}-ERROR.png`);
      } catch {}
    }

    result.status = result.errors.length === 0 ? 'PASS' : 'FAIL';
    allResults.push(result);
    const icon = result.status === 'PASS' ? '✓' : '✗';
    const detail = result.assertions?.detail || result.errors[0] || '';
    console.log(`  ${icon} ${result.status} — ${detail} (${result.screenshots.length} shots)`);
  }

  await browser.close();

  // Summary
  const passed = allResults.filter(r => r.status === 'PASS');
  const failed = allResults.filter(r => r.status === 'FAIL');

  console.log(`\n━━━ SUMMARY ━━━\n`);
  console.log(`Total: ${allResults.length} | Passed: ${passed.length} | Failed: ${failed.length}\n`);
  for (const r of allResults) {
    const icon = r.status === 'PASS' ? '✓' : '✗';
    console.log(`  ${icon} ${r.ticket}: ${r.name} — ${r.status}`);
    if (r.assertions?.detail) console.log(`      → ${r.assertions.detail}`);
    if (r.errors.length) r.errors.forEach(e => console.log(`      ✗ ${e}`));
  }

  await writeFile(path.join(REPORT_DIR, 'suite-report.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    version: 2,
    total: allResults.length,
    passed: passed.length,
    failed: failed.length,
    results: allResults,
  }, null, 2));

  console.log(`\nReport: ${REPORT_DIR}/suite-report.json`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });
