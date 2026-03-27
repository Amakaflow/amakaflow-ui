# Smoke Verification Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Every implementation plan ends with a `smoke.ts` script. Before any PR is created, two-step smoke verification runs: (1) headed Playwright so David watches the browser live, (2) headless screenshot review so David confirms each frame inline. The PR is only offered after both steps pass.

**Problem:** Unit tests pass but nobody actually ran the UI. Features ship as "done" after a green CI badge, but the real question — does it work in a browser? — is never answered in the workflow.

**Scope:** Three changes — `writing-plans` skill gets a mandatory final task template, `finishing-a-development-branch` gets the smoke verification phase, `lfg` Phase 6 picks it up before pushing.

---

## The smoke.ts File

**Location:** `scripts/smoke/<ama-NNN>-<short-name>.ts`

Dedicated folder at the repo root, named by ticket. Not colocated with feature code — smoke scripts are ephemeral verification tools, not shipped code.

**Standard template:**

```ts
// scripts/smoke/ama-NNN-feature-name.ts
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE_URL = process.env.SMOKE_URL ?? 'http://localhost:5173';
const HEADLESS = process.env.HEADLESS === '1';

await mkdir('/tmp/smoke', { recursive: true });

const browser = await chromium.launch({ headless: HEADLESS });
const page = await browser.newPage();

// Frame 1: Page/route loads
await page.goto(`${BASE_URL}/path`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/tmp/smoke/frame-1-loaded.png' });

// Frame 2: Primary action works
await page.click('text=Primary Button');
await page.waitForSelector('[data-result]', { timeout: 5000 });
await page.screenshot({ path: '/tmp/smoke/frame-2-action.png' });

// Frame 3: Expected result visible
await page.screenshot({ path: '/tmp/smoke/frame-3-result.png' });

await browser.close();
console.log('Smoke complete. Screenshots in /tmp/smoke/');
```

Headed vs headless controlled by `HEADLESS=1` env var — same script, two modes.

**Coverage target: 3-5 frames per feature:**
- Frame 1: Page loads, key element visible
- Frame 2: Primary action triggered
- Frame 3: Expected result appears
- Frame 4+ (optional): Step-through paths, error states

---

## finishing-a-development-branch — New Smoke Phase

Current flow: `unit tests pass → present 4 options`

New flow:

```
1. Unit tests pass
2. Check for smoke file at scripts/smoke/<ticket>-*.ts
   → If not found: "No smoke test found. Write one now, or skip verification?"
   → Never auto-skip
3. Step 1 — Headed run:
   mkdir -p /tmp/smoke
   python scripts/with_server.py --server "npm run dev" --port PORT \
     -- npx tsx scripts/smoke/<ticket>.ts
   → Browser opens, David watches live
   → "Did the headed run look right? (y/n)"
   → If n: stop, investigate before proceeding
4. Step 2 — Screenshot review:
   HEADLESS=1 npx tsx scripts/smoke/<ticket>.ts
   → Read each /tmp/smoke/frame-*.png inline (Claude reads images)
   → "Frame 1/N: [description] — does this look right? (y/n)"
   → One frame at a time, wait for confirmation
   → If n on any frame: stop, open browser to that URL, investigate
5. "Smoke verified ✓. What would you like to do?"
6. Present 4 options (merge / PR / keep / discard)
```

---

## writing-plans — Mandatory Final Task

Every implementation plan automatically gets this as its last task:

```markdown
### Task N (Final): Write Smoke Test

**File:** `scripts/smoke/<ama-NNN>-<feature-name>.ts`

**Coverage (3-5 frames):**
- Frame 1: Route loads, key element visible
- Frame 2: Primary action works
- Frame 3: Expected result appears
- [Frame 4+: Additional paths if relevant]

**Run to verify locally:**
\`\`\`bash
mkdir -p /tmp/smoke
npx tsx scripts/smoke/<ama-NNN>-<feature-name>.ts
# View screenshots in /tmp/smoke/
\`\`\`

**Commit:**
\`\`\`bash
git add scripts/smoke/ && git commit -m "test(ama-NNN): add smoke test"
\`\`\`
```

---

## lfg — Phase 6 Integration

Phase 6 (Ship) already pushes and creates the PR. Insert smoke verification between Phase 5 (Code Review) and Phase 6:

```
Phase 5: Code Review complete
Phase 5.5: Smoke verification (same two-step process as above)
  → If smoke file exists: run it
  → If not: "No smoke test found — write one before shipping?"
Phase 6: Ship (push + PR)
```

---

## Done State

- Every new implementation plan ends with a `scripts/smoke/<ama-NNN>-*.ts` task
- `finishing-a-development-branch` runs headed run + screenshot review before offering PR options
- `lfg` Phase 6 is gated on smoke verification
- `scripts/smoke/` directory exists in the repo with a `.gitkeep`
- Memory rule is saved (already done)
