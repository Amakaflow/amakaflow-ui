#!/usr/bin/env node
/**
 * Persona Testing Engine v2 — JSON-driven synthetic users with diary reports
 *
 * Loads persona definitions from scripts/personas/*.json, runs each through
 * their journey (web via Playwright or API-only via fetch), generates
 * screenshot diaries with pass/fail verdicts.
 *
 * Usage:
 *   node scripts/persona-engine.mjs                      # Run all personas
 *   node scripts/persona-engine.mjs --persona sarah      # Run one persona
 *   node scripts/persona-engine.mjs --persona ray        # API-only persona
 */

import { chromium } from 'playwright';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:3000';
const PERSONAS_DIR = path.join(__dirname, 'personas');
const DOCS_DIR = '/Users/davidmini/.openclaw/workspace/amakaflow-docs/persona-diaries';
const TIMESTAMP = new Date().toISOString().slice(0, 10);
const RUN_TIME = new Date().toISOString().slice(11, 16).replace(':', '');
const RUN_DIR = `${DOCS_DIR}/${TIMESTAMP}`;

// ═══════════════════════════════════════════════════════════════════════
// LOAD PERSONAS FROM JSON
// ═══════════════════════════════════════════════════════════════════════

async function loadPersonas() {
  const files = (await readdir(PERSONAS_DIR)).filter(f => f.endsWith('.json'));
  return Promise.all(files.map(async f => JSON.parse(await readFile(path.join(PERSONAS_DIR, f), 'utf-8'))));
}

// ═══════════════════════════════════════════════════════════════════════
// STEP HANDLERS
// ═══════════════════════════════════════════════════════════════════════

async function executeStep(step, page, userId) {
  switch (step.type) {
    case 'navigate':
      await page.goto(`${BASE_URL}${step.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      return { pass: true, check: `Navigated to ${step.url}` };

    case 'dropdown': {
      await page.getByTestId(step.menu).click();
      await page.waitForTimeout(500);
      await page.getByRole('menuitem', { name: step.item }).click();
      await page.waitForTimeout(2000);
      return { pass: true, check: `Opened ${step.item}` };
    }

    case 'click': {
      let locator;
      if (step.text) {
        locator = page.getByRole('button', { name: new RegExp(step.text, 'i') });
        if (step.nth !== undefined) locator = locator.nth(step.nth);
        else locator = locator.first();
      } else {
        locator = page.locator(step.selector).first();
      }
      if (await locator.isVisible({ timeout: 5000 }).catch(() => false)) {
        await locator.click();
        await page.waitForTimeout(1500);
        return { pass: true, check: `Clicked "${step.text || step.selector}"` };
      }
      return { pass: false, check: `Button "${step.text || step.selector}" not found` };
    }

    case 'youtube-import': {
      const urlInput = page.getByPlaceholder(/paste.*url/i).first();
      await urlInput.fill(step.url);
      await page.getByRole('button', { name: /add to queue/i }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /import \d+ item/i }).click();
      // Wait for results (up to 90s)
      for (let i = 0; i < 45; i++) {
        if (await page.getByRole('button', { name: 'Edit' }).isVisible().catch(() => false)) break;
        if (await page.getByText(/exercises/i).isVisible().catch(() => false)) break;
        await page.waitForTimeout(2000);
      }
      const hasResults = await page.getByText(/exercises/i).isVisible().catch(() => false)
        || await page.getByRole('button', { name: 'Edit' }).isVisible().catch(() => false);
      return { pass: hasResults, check: hasResults ? 'YouTube workout imported' : 'Import did not complete' };
    }

    case 'validate': {
      const count = await page.locator(step.selector).count();
      if (step.expect === 'count > 0') {
        return { pass: count > 0, check: `Found ${count} items (expected > 0)` };
      }
      return { pass: count > 0, check: `Validation: ${count} items` };
    }

    case 'edit-exercise': {
      // Find and click exercise edit button
      const rows = page.locator('.rounded-lg.border.bg-muted\\/50');
      if (await rows.count() > 0) {
        await rows.first().locator('button').first().click();
        await page.waitForTimeout(1000);
        const dialogOpen = await page.getByRole('dialog').isVisible().catch(() => false);
        if (dialogOpen && step.tab) {
          const tab = page.getByRole('tab', { name: new RegExp(step.tab, 'i') });
          if (await tab.isVisible().catch(() => false)) {
            await tab.click();
            await page.waitForTimeout(500);
          }
          // Close dialog
          const doneBtn = page.getByRole('button', { name: /Done/i }).last();
          await doneBtn.evaluate(el => el.click()).catch(() => page.keyboard.press('Escape'));
          await page.waitForTimeout(500);
          return { pass: true, check: `Edited exercise — switched to ${step.tab}` };
        }
        return { pass: dialogOpen, check: dialogOpen ? 'Edit dialog opened' : 'Edit dialog did not open' };
      }
      return { pass: false, check: 'No exercise rows found' };
    }

    case 'block-type-change': {
      const selects = page.locator('[role="combobox"]');
      if (await selects.count() > 0) {
        await selects.first().click();
        await page.waitForTimeout(500);
        const target = page.locator(`[role="option"]:has-text("${step.targetType}")`);
        if (await target.isVisible().catch(() => false)) {
          await target.click();
          await page.waitForTimeout(500);
          return { pass: true, check: `Block type changed to ${step.targetType}` };
        }
        await page.keyboard.press('Escape');
        return { pass: false, check: `Block type "${step.targetType}" not found in options` };
      }
      return { pass: false, check: 'No block type selector found' };
    }

    case 'api': {
      return await executeApiStep(step, userId);
    }

    case 'api-multi': {
      let allOk = true;
      const results = [];
      for (const check of step.checks) {
        try {
          const resp = await fetch(`http://localhost:${check.port}${check.endpoint}`, { timeout: 5000 });
          results.push(`${check.port}: ${resp.status}`);
          if (!resp.ok) allOk = false;
        } catch {
          results.push(`${check.port}: DOWN`);
          allOk = false;
        }
      }
      return { pass: allOk, check: `Health: ${results.join(', ')}` };
    }

    default:
      return { pass: false, check: `Unknown step type: ${step.type}` };
  }
}

async function executeApiStep(step, userId) {
  try {
    const headers = {
      'X-Test-Auth': 'local-dev-test-secret',
      'X-Test-User-Id': userId,
    };
    if (step.contentType) {
      headers['Content-Type'] = step.contentType;
    } else {
      headers['Content-Type'] = 'application/json';
    }

    const port = step.port || 8005;
    let body;
    if (step.contentType === 'text/plain') {
      body = typeof step.body === 'string' ? step.body : JSON.stringify(step.body);
    } else {
      // Replace "TODAY" placeholder with actual date
      let bodyObj = step.body;
      if (bodyObj && JSON.stringify(bodyObj).includes('"TODAY"')) {
        bodyObj = JSON.parse(JSON.stringify(bodyObj).replace(/"TODAY"/g, `"${TIMESTAMP}"`));
      }
      body = bodyObj ? JSON.stringify(bodyObj) : undefined;
    }

    const resp = await fetch(`http://localhost:${port}${step.endpoint}`, {
      method: step.method || 'GET',
      headers,
      body: step.method !== 'GET' ? body : undefined,
    });

    // Handle SSE streams
    if (step.expectStream) {
      const text = await resp.text();
      const hasData = text.includes('data:');

      // Strict tool check (must call specific tool)
      if (step.expectTool) {
        const hasTool = text.includes(step.expectTool);
        return {
          pass: hasData && hasTool,
          check: `API stream: ${hasData ? 'received' : 'empty'}, tool ${step.expectTool}: ${hasTool ? 'called' : 'NOT called'}`,
        };
      }

      // Flexible check: tool call OR workout content in text (AI non-determinism)
      if (step.expectToolOrContent) {
        const hasTool = text.includes(step.expectToolOrContent);
        const hasWorkoutContent = /exercise|workout|sets|reps|bench|squat|press/i.test(text);
        const pass = hasData && (hasTool || hasWorkoutContent);
        return {
          pass,
          check: `API stream: ${hasData ? 'received' : 'empty'}, tool: ${hasTool ? 'called' : 'no'}, content: ${hasWorkoutContent ? 'has exercises' : 'no exercises'}`,
        };
      }

      return { pass: hasData, check: `API stream: ${hasData ? 'received' : 'empty'}` };
    }

    const data = await resp.json().catch(() => null);

    // Check expected field
    if (step.expectField) {
      if (step.expectField.includes('>')) {
        const [field, op] = step.expectField.split(' > ');
        let val;
        if (field === 'length') {
          // Bare array response: data is the array
          val = Array.isArray(data) ? data.length : 0;
        } else if (field.endsWith('.length')) {
          // Nested array: e.g. "workouts.length" → data.workouts.length
          const arrayKey = field.slice(0, -'.length'.length);
          const arr = data?.[arrayKey];
          val = Array.isArray(arr) ? arr.length : 0;
        } else {
          val = data?.[field];
        }
        const pass = val > parseInt(op);
        return { pass, check: `API ${step.endpoint}: ${field}=${val} (expected > ${op})` };
      }
      const hasField = data && step.expectField in data;
      return { pass: hasField, check: `API ${step.endpoint}: ${step.expectField} ${hasField ? 'present' : 'missing'}` };
    }

    return { pass: resp.ok, check: `API ${step.endpoint}: ${resp.status}` };
  } catch (err) {
    return { pass: false, check: `API error: ${err.message.slice(0, 100)}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// DIARY ENGINE
// ═══════════════════════════════════════════════════════════════════════

async function runPersona(persona) {
  const personaDir = `${RUN_DIR}/${persona.id}`;
  await mkdir(personaDir, { recursive: true });

  const userId = `persona-${persona.id}-${TIMESTAMP}`;
  const diary = {
    persona: persona.name,
    profile: persona.profile,
    userId,
    tier: persona.tier,
    mode: persona.mode,
    date: new Date().toISOString(),
    steps: [],
    score: { passed: 0, failed: 0, total: persona.steps.length },
  };

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${persona.name} — ${persona.profile}`);
  console.log(`  User ID: ${userId} | Mode: ${persona.mode}`);
  console.log(`${'═'.repeat(60)}\n`);

  let browser, context, page;

  if (persona.mode === 'web') {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();

    // Inject persona user ID into all API requests
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.includes('/api/') || url.includes(':800')) {
        const headers = { ...route.request().headers(), 'x-test-user-id': userId };
        await route.continue({ headers });
      } else {
        await route.continue();
      }
    });

    // Initialize page
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.evaluate((uid) => localStorage.setItem('persona_id', uid), userId);
    await page.waitForTimeout(500);
  }

  for (let i = 0; i < persona.steps.length; i++) {
    const step = persona.steps[i];
    const stepNum = String(i + 1).padStart(2, '0');
    console.log(`  Step ${stepNum}: ${step.name}...`);

    let result;
    try {
      result = await executeStep(step, page, userId);
    } catch (err) {
      result = { pass: false, check: `CRASH: ${err.message.slice(0, 150)}` };
    }

    // Evidence capture: screenshot for UI steps, JSON for API steps.
    // Previously we screenshotted unconditionally after every step, which
    // produced stale screenshots of the previous page for API steps and
    // polluted the visual golden set. Now UI and API steps are separated.
    const slug = step.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const isApiStep = step.type === 'api' || step.type === 'api-multi';
    let screenshotName = null;
    let apiEvidenceName = null;

    if (isApiStep) {
      apiEvidenceName = `${stepNum}-${slug}.json`;
      const apiEvidence = {
        step: step.name,
        type: step.type,
        request: {
          port: step.port || null,
          endpoint: step.endpoint || null,
          method: step.method || 'GET',
          body: step.body || null,
        },
        result,
      };
      await writeFile(
        `${personaDir}/${apiEvidenceName}`,
        JSON.stringify(apiEvidence, null, 2)
      ).catch(() => {});
    } else if (page) {
      screenshotName = `${stepNum}-${slug}.png`;
      await page.screenshot({ path: `${personaDir}/${screenshotName}`, fullPage: true }).catch(() => {});
    }

    const icon = result.pass ? '✅' : '❌';
    console.log(`    ${icon} ${result.check}`);

    diary.steps.push({
      number: i + 1,
      name: step.name,
      type: step.type,
      check: result.check,
      passed: result.pass,
      screenshot: screenshotName,
      apiEvidence: apiEvidenceName,
    });

    if (result.pass) diary.score.passed++;
    else diary.score.failed++;
  }

  if (context) await context.close();
  if (browser) await browser.close();

  // Write diary JSON + markdown
  await writeFile(`${personaDir}/diary.json`, JSON.stringify(diary, null, 2));

  const md = [
    `# ${persona.name} — Persona Diary`,
    `**Profile:** ${persona.profile}`,
    `**User ID:** ${userId}`,
    `**Tier:** ${persona.tier} | **Mode:** ${persona.mode}`,
    `**Date:** ${diary.date}`,
    `**Score:** ${diary.score.passed}/${diary.score.total} steps passed`,
    '',
    '## Steps',
    '',
    ...diary.steps.map(s => {
      const icon = s.passed ? '✅' : '❌';
      let evidence = '';
      if (s.screenshot) {
        evidence = `\n![${s.name}](./${s.screenshot})\n`;
      } else if (s.apiEvidence) {
        evidence = `\n[API evidence](./${s.apiEvidence})\n`;
      }
      return `### Step ${s.number}: ${s.name}\n${icon} ${s.check}${evidence}`;
    }),
    '---',
    'Generated by AmakaFlow Persona Engine v2',
  ].join('\n');
  await writeFile(`${personaDir}/diary.md`, md);

  console.log(`\n  Score: ${diary.score.passed}/${diary.score.total}`);
  return diary;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const targetPersona = args.find(a => a.startsWith('--persona='))?.split('=')[1]
  || (args.includes('--persona') ? args[args.indexOf('--persona') + 1] : null);

const allPersonas = await loadPersonas();
const personasToRun = targetPersona
  ? allPersonas.filter(p => p.id.includes(targetPersona) || p.name.toLowerCase().includes(targetPersona.toLowerCase()))
  : allPersonas;

if (personasToRun.length === 0) {
  console.log(`No persona matching "${targetPersona}". Available: ${allPersonas.map(p => p.id).join(', ')}`);
  process.exit(1);
}

console.log(`\n🎭 AmakaFlow Persona Engine v2`);
console.log(`   Running ${personasToRun.length} persona(s) — ${TIMESTAMP}\n`);

await mkdir(RUN_DIR, { recursive: true });

const allDiaries = [];
for (const persona of personasToRun) {
  const diary = await runPersona(persona);
  allDiaries.push(diary);
}

// Summary
console.log(`\n${'═'.repeat(60)}`);
console.log(`  SUMMARY — ${TIMESTAMP}`);
console.log(`${'═'.repeat(60)}`);
for (const d of allDiaries) {
  const icon = d.score.failed === 0 ? '✅' : '⚠️';
  console.log(`  ${icon} ${d.persona} (${d.mode}): ${d.score.passed}/${d.score.total} passed`);
  for (const s of d.steps) {
    console.log(`     ${s.passed ? '✅' : '❌'} ${s.name}: ${s.check}`);
  }
}
console.log(`${'═'.repeat(60)}`);

// Write summary
const summaryMd = [
  `# Persona Test Run — ${TIMESTAMP}`,
  '',
  '| Persona | Profile | Tier | Mode | Score | Status |',
  '|---------|---------|------|------|-------|--------|',
  ...allDiaries.map(d => {
    const icon = d.score.failed === 0 ? '✅' : '⚠️';
    return `| ${d.persona} | ${d.profile.slice(0, 40)} | ${d.tier} | ${d.mode} | ${d.score.passed}/${d.score.total} | ${icon} |`;
  }),
  '',
  '## Diaries',
  '',
  ...allDiaries.map(d => `- [${d.persona}](./${allPersonas.find(p => p.name === d.persona)?.id || 'unknown'}/diary.md)`),
].join('\n');
await writeFile(`${RUN_DIR}/summary.md`, summaryMd);

console.log(`\nDiaries: ${RUN_DIR}`);
const totalPassed = allDiaries.reduce((s, d) => s + d.score.passed, 0);
const totalSteps = allDiaries.reduce((s, d) => s + d.score.total, 0);
console.log(`Total: ${totalPassed}/${totalSteps}`);
process.exit(totalPassed === totalSteps ? 0 : 1);
