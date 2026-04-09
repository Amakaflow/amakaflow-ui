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
import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { createPersonaUser, deletePersonaUser, loadEnvLocal } from './personas/clerk-setup.mjs';

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

async function executeStep(step, page, userId, ctx) {
  switch (step.type) {
    case 'navigate':
      await page.goto(`${BASE_URL}${step.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      return { pass: true, check: `Navigated to ${step.url}` };

    case 'login': {
      // Real Clerk auth via @clerk/testing's official Playwright helper.
      // Bypasses the UI form entirely — clerk.signIn() calls Clerk's client
      // SDK directly with the identifier and password, creating a real session
      // and injecting it into the browser. This is the canonical Clerk
      // testing pattern documented at:
      //   https://clerk.com/docs/testing/playwright/test-authenticated-flows
      //
      // The user is provisioned at run start by createPersonaUser() in
      // clerk-setup.mjs (which calls @clerk/backend's users.createUser).
      // Credentials flow through ctx into this step.
      if (!ctx?.clerkReady) {
        // clerkSetup() failed earlier in the run. Skip with a clear message
        // rather than triggering a noisy Clerk client error inside signIn.
        return {
          pass: false,
          check: 'Skipped — clerkSetup did not succeed (CLERK_PUBLISHABLE_KEY missing or dev instance unreachable?)',
        };
      }
      if (!ctx?.credentials) {
        return { pass: false, check: 'login step requires Clerk credentials in run context' };
      }
      const { email, password } = ctx.credentials;

      try {
        // Navigate to the app first — Clerk's signIn helper needs an active
        // page context with Clerk's SDK loaded.
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1000);

        await clerk.signIn({
          page,
          signInParams: {
            strategy: 'password',
            identifier: email,
            password,
          },
        });

        // Navigate again to force ClerkProvider to re-read the session
        // cookies and re-render the authenticated view. Per Clerk's docs
        // pattern (docs/testing/playwright/test-authenticated-flows), the
        // navigation AFTER signIn is what propagates the session into the
        // React app. Without it, the cookies are set but the UI still
        // shows the landing page.
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(2000);

        // Diagnostic DOM dump (kept as a safety net per 2026-04-09 decision).
        // If clerk.signIn() worked, we should see a real session key in
        // localStorage (__clerk_client_jwt or similar). If it didn't, the
        // diagnostic lets us see exactly what state the page is in.
        if (ctx?.personaDir) {
          await page
            .screenshot({
              path: `${ctx.personaDir}/00-login-diagnostic-mid-submit.png`,
              fullPage: true,
            })
            .catch(() => {});
        }

        // Read cookies from the browser CONTEXT, not document.cookie.
        // document.cookie cannot see HttpOnly cookies (RFC 6265), and
        // Clerk's __session is typically HttpOnly in production. Reading
        // via page.context().cookies() sees all cookies regardless. This
        // aligns with Clerk's Playwright testing guide:
        // https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows
        const contextCookies = await page.context().cookies(BASE_URL);
        const cookieNames = contextCookies.map((c) => c.name);

        const domState = await page.evaluate(() => {
          const localStorageKeys = Object.keys(localStorage || {});
          const sessionStorageKeys = Object.keys(sessionStorage || {});
          const clerkLocalKeys = localStorageKeys.filter((k) => k.toLowerCase().includes('clerk'));
          const clerkSessionKeys = sessionStorageKeys.filter((k) => k.toLowerCase().includes('clerk'));
          const buttons = Array.from(document.querySelectorAll('button'))
            .filter((b) => {
              const r = b.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            })
            .map((b) => (b.textContent || '').trim().slice(0, 60))
            .filter(Boolean);
          const errorText = Array.from(document.querySelectorAll('[role="alert"], .cl-formFieldError, .cl-alert, [data-clerk-error]'))
            .map((el) => (el.textContent || '').trim().slice(0, 200))
            .filter(Boolean);
          const modalVisible = !!document.querySelector('.cl-modalContent, .cl-signIn-root, .cl-card');
          return {
            url: location.href,
            pathname: location.pathname,
            localStorageKeys,
            sessionStorageKeys,
            clerkLocalKeys,
            clerkSessionKeys,
            visibleButtons: buttons,
            errorText,
            modalVisible,
          };
        });
        domState.cookieCount = cookieNames.length;
        domState.cookieNames = cookieNames;
        console.log('    🔬 DIAGNOSTIC DOM STATE after password submit:');
        console.log('       url:', domState.url);
        console.log('       modalVisible:', domState.modalVisible);
        console.log('       clerkLocalKeys:', domState.clerkLocalKeys);
        console.log('       clerkSessionKeys:', domState.clerkSessionKeys);
        console.log('       visibleButtons:', domState.visibleButtons);
        console.log('       errorText:', domState.errorText);
        console.log('       localStorageKeys:', domState.localStorageKeys);
        console.log('       cookieCount:', domState.cookieCount);
        if (ctx?.personaDir) {
          await writeFile(
            `${ctx.personaDir}/00-login-diagnostic-dom.json`,
            JSON.stringify(domState, null, 2)
          ).catch(() => {});
        }

        // Real success signal: Clerk's __session cookie. clerk.signIn()
        // creates the session server-side via Clerk's API and sets the
        // session JWT as a cookie. localStorage only gets
        // __clerk_environment (instance config, not auth state), so
        // checking cookies is ground truth for "is this browser signed in".
        // Check cookie NAMES (not values) to avoid leaking JWTs in logs.
        const hasSessionCookie =
          domState.cookieNames.includes('__session') ||
          domState.cookieNames.some((n) => n.startsWith('__clerk_db_jwt'));
        if (!hasSessionCookie) {
          const errMsg =
            domState.errorText.length > 0
              ? `Clerk error: ${domState.errorText.join('; ')}`
              : 'No Clerk __session cookie — clerk.signIn() did not create a session';
          return { pass: false, check: `Login failed: ${errMsg}` };
        }

        return { pass: true, check: `Logged in as ${email}` };
      } catch (err) {
        return { pass: false, check: `Login failed: ${err.message.slice(0, 150)}` };
      }
    }

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
      const perCheck = [];
      for (const check of step.checks) {
        try {
          const resp = await fetch(`http://localhost:${check.port}${check.endpoint}`, { timeout: 5000 });
          results.push(`${check.port}: ${resp.status}`);
          perCheck.push({
            port: check.port,
            endpoint: check.endpoint,
            status: resp.status,
            ok: resp.ok,
          });
          if (!resp.ok) allOk = false;
        } catch (err) {
          results.push(`${check.port}: DOWN`);
          perCheck.push({
            port: check.port,
            endpoint: check.endpoint,
            error: err.message.slice(0, 200),
          });
          allOk = false;
        }
      }
      return {
        pass: allOk,
        check: `Health: ${results.join(', ')}`,
        response: { checks: perCheck },
      };
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

    // Response metadata captured on EVERY return path so the diary's API
    // evidence JSON has status + body to inspect when a step fails.
    // Per AMA-1445 spec: evidence is request + response + result.
    const respMeta = { status: resp.status, ok: resp.ok };

    // Handle SSE streams
    if (step.expectStream) {
      const text = await resp.text();
      const hasData = text.includes('data:');
      // Keep a bounded slice of the stream for evidence — full SSE can be huge.
      respMeta.bodyKind = 'stream';
      respMeta.bodyPreview = text.slice(0, 2000);

      // Strict tool check (must call specific tool)
      if (step.expectTool) {
        const hasTool = text.includes(step.expectTool);
        return {
          pass: hasData && hasTool,
          check: `API stream: ${hasData ? 'received' : 'empty'}, tool ${step.expectTool}: ${hasTool ? 'called' : 'NOT called'}`,
          response: respMeta,
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
          response: respMeta,
        };
      }

      return {
        pass: hasData,
        check: `API stream: ${hasData ? 'received' : 'empty'}`,
        response: respMeta,
      };
    }

    const data = await resp.json().catch(() => null);
    respMeta.bodyKind = 'json';
    respMeta.body = data;

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
        return {
          pass,
          check: `API ${step.endpoint}: ${field}=${val} (expected > ${op})`,
          response: respMeta,
        };
      }
      const hasField = data && step.expectField in data;
      return {
        pass: hasField,
        check: `API ${step.endpoint}: ${step.expectField} ${hasField ? 'present' : 'missing'}`,
        response: respMeta,
      };
    }

    return {
      pass: resp.ok,
      check: `API ${step.endpoint}: ${resp.status}`,
      response: respMeta,
    };
  } catch (err) {
    return {
      pass: false,
      check: `API error: ${err.message.slice(0, 100)}`,
      response: { error: err.message.slice(0, 500) },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// DIARY ENGINE
// ═══════════════════════════════════════════════════════════════════════

async function runPersona(persona, runOptions = {}) {
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

  // Provision a real Clerk user if any step needs login AND Clerk setup
  // succeeded. If clerkSetup failed earlier we skip provisioning entirely
  // (no point creating a user we can't sign in with), and the login step
  // itself will report "Skipped — clerkSetup did not succeed".
  const needsLogin = persona.steps.some((s) => s.type === 'login');
  const clerkReady = runOptions.clerkReady === true;
  let clerkCredentials = null;
  if (needsLogin && clerkReady) {
    try {
      clerkCredentials = await createPersonaUser(persona);
      console.log(`  🔐 Provisioned Clerk user ${clerkCredentials.email} (id=${clerkCredentials.userId})`);
    } catch (err) {
      console.error(`  ❌ Clerk user provisioning failed: ${err.message}`);
      // Continue — login step will fail with a clear error and the rest of
      // the run will be visible in the diary so we can debug.
    }
  } else if (needsLogin && !clerkReady) {
    console.warn(`  ⚠️  Skipping Clerk user provisioning: clerkSetup did not succeed`);
  }
  const ctx = { credentials: clerkCredentials, personaDir, clerkReady };

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${persona.name} — ${persona.profile}`);
  console.log(`  User ID: ${userId} | Mode: ${persona.mode}`);
  console.log(`${'═'.repeat(60)}\n`);

  let browser, context, page;

  // Wrap the entire run in try/finally so Clerk/Supabase teardown always
  // fires, even if a step crashes, the browser launch fails, or the
  // evidence writer throws mid-run. Without this, any unhandled exception
  // would orphan the provisioned Clerk user and Supabase profile row.
  try {
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
        result = await executeStep(step, page, userId, ctx);
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
          // AMA-1445 spec: evidence is request + response + result. The
          // response comes from executeApiStep / api-multi and contains the
          // HTTP status, body (JSON or stream preview), and any error
          // message, so failing API steps can be diagnosed from the diary
          // alone without re-running.
          response: result.response || null,
          result: { pass: result.pass, check: result.check },
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
  } finally {
    // Browser teardown. Independent try/catch each so one failure doesn't
    // skip the Clerk cleanup below.
    if (context) {
      try { await context.close(); } catch (err) {
        console.warn(`  ⚠️  context.close() failed: ${err.message}`);
      }
    }
    if (browser) {
      try { await browser.close(); } catch (err) {
        console.warn(`  ⚠️  browser.close() failed: ${err.message}`);
      }
    }

    // Tear down the Clerk user + Supabase profile row. Idempotent — logs a
    // warning if cleanup fails so we don't mask the real test result, but
    // flags any orphans for manual review.
    if (clerkCredentials?.userId) {
      try {
        await deletePersonaUser(clerkCredentials.userId);
        console.log(`  🧹 Deleted Clerk user ${clerkCredentials.email}`);
      } catch (err) {
        console.warn(`  ⚠️  deletePersonaUser failed: ${err.message}`);
        console.warn(`     Orphan user ${clerkCredentials.userId} may need manual cleanup.`);
      }
    }
  }

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

// Reload .env.local in case clerk-setup.mjs's module-load call missed any
// keys we set later. loadEnvLocal is idempotent (it skips pre-set vars) and
// imported from clerk-setup.mjs so there's only one parser in the codebase.
await loadEnvLocal();

// @clerk/testing looks for CLERK_PUBLISHABLE_KEY; the Vite app uses the
// VITE_ prefix. Mirror the value so the testing SDK finds it.
if (process.env.VITE_CLERK_PUBLISHABLE_KEY && !process.env.CLERK_PUBLISHABLE_KEY) {
  process.env.CLERK_PUBLISHABLE_KEY = process.env.VITE_CLERK_PUBLISHABLE_KEY;
}

// Clerk's canonical Playwright auth bootstrap: fetches a Testing Token
// once per suite that bypasses Clerk's bot detection for subsequent
// clerk.signIn() calls. See:
//   https://clerk.com/docs/testing/playwright/overview
//
// If clerkSetup fails AND any persona we're about to run needs login,
// fail fast in CI rather than wasting time running steps that will all
// fail at the auth gate.
let clerkReady = false;
try {
  await clerkSetup();
  clerkReady = true;
  console.log(`   🔐 Clerk testing token obtained (dev instance)\n`);
} catch (err) {
  console.warn(`   ⚠️  clerkSetup failed: ${err.message}`);
  console.warn(`      Login steps will not work until this is resolved.\n`);
  const anyNeedsLogin = personasToRun.some((p) =>
    p.steps.some((s) => s.type === 'login')
  );
  if (anyNeedsLogin && process.env.CI) {
    console.error(
      `   ❌ Exiting: CI run requires Clerk auth but clerkSetup failed.`
    );
    process.exit(1);
  }
}

await mkdir(RUN_DIR, { recursive: true });

const allDiaries = [];
for (const persona of personasToRun) {
  const diary = await runPersona(persona, { clerkReady });
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
