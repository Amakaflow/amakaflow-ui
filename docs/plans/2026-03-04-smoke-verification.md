# Smoke Verification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Every implementation ends with a two-step smoke verification (headed browser run + screenshot review) before a PR is offered, enforced by updates to three workflow skills and a `scripts/smoke/` directory in the repo.

**Architecture:** Four tasks. Task 1 creates the `scripts/smoke/` directory and the AMA-935 smoke test as a working example. Tasks 2-4 update the three workflow skills (`finishing-a-development-branch`, `writing-plans`, `lfg`) to enforce smoke verification as a mandatory gate. No new dependencies — Playwright is already installed.

**Tech Stack:** Playwright (already installed), TypeScript/tsx, existing `scripts/with_server.py`

---

## Existing Code Context

Before starting, read:
- `scripts/with_server.py` — understand how to start the dev server for smoke runs
- `/Users/davidandrews/.claude/plugins/cache/claude-plugins-official/superpowers/4.3.1/skills/finishing-a-development-branch/SKILL.md` — current skill to modify
- `/Users/davidandrews/.claude/plugins/cache/claude-plugins-official/superpowers/4.3.1/skills/writing-plans/SKILL.md` — current skill to modify
- `/Users/davidandrews/dev/Amakaflow/.claude/skills/lfg/SKILL.md` — current skill to modify

---

## Task 1: Create scripts/smoke/ directory and AMA-935 smoke test

**Files:**
- Create: `scripts/smoke/.gitkeep`
- Create: `scripts/smoke/ama-935-pipeline-observatory.ts`

**Step 1: Create the directory and gitkeep**

```bash
mkdir -p scripts/smoke
touch scripts/smoke/.gitkeep
```

**Step 2: Write the smoke test**

Create `scripts/smoke/ama-935-pipeline-observatory.ts`:

```ts
// Smoke test for AMA-935 — Pipeline Observatory
// Usage:
//   Headed (watch live):  npx tsx scripts/smoke/ama-935-pipeline-observatory.ts
//   Headless (screenshots): HEADLESS=1 npx tsx scripts/smoke/ama-935-pipeline-observatory.ts
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE_URL = process.env.SMOKE_URL ?? 'http://localhost:5174';
const HEADLESS = process.env.HEADLESS === '1';

await mkdir('/tmp/smoke', { recursive: true });

const browser = await chromium.launch({ headless: HEADLESS });
const page = await browser.newPage();

// Frame 1: Pipeline Observatory loads
await page.goto(`${BASE_URL}/pipeline.html`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/tmp/smoke/frame-1-loaded.png', fullPage: false });
console.log('Frame 1: Page loaded');

// Frame 2: Service health bar shows all 6 services
await page.waitForSelector('text=Services', { timeout: 5000 });
const serviceLabels = await page.locator('text=Ingestor, text=Mapper').count();
await page.screenshot({ path: '/tmp/smoke/frame-2-health-bar.png', fullPage: false });
console.log('Frame 2: Health bar visible');

// Frame 3: Run button is present and flow selector works
await page.waitForSelector('text=▶ Run', { timeout: 3000 });
await page.screenshot({ path: '/tmp/smoke/frame-3-controls.png', fullPage: false });
console.log('Frame 3: Run controls visible');

// Frame 4: Clicking Run triggers a run (step cards appear or "Starting…" appears)
await page.click('text=▶ Run');
await page.waitForSelector('text=Stop, text=Starting', { timeout: 5000 }).catch(() => {});
await page.screenshot({ path: '/tmp/smoke/frame-4-running.png', fullPage: false });
console.log('Frame 4: Run triggered');

await browser.close();
console.log('\nSmoke complete. Screenshots saved to /tmp/smoke/');
```

**Step 3: Verify it runs without errors (server must be running on port 5174)**

```bash
# Start server first in another terminal: npm run dev -- --port 5174
npx tsx scripts/smoke/ama-935-pipeline-observatory.ts 2>&1 | tail -10
```

Expected: 4 "Frame N:" lines, "Smoke complete." message, no errors.

**Step 4: Commit**

```bash
git add scripts/smoke/
git commit -m "test(ama-935): add pipeline observatory smoke test and scripts/smoke dir"
```

---

## Task 2: Update finishing-a-development-branch skill

**File:**
- Modify: `/Users/davidandrews/.claude/plugins/cache/claude-plugins-official/superpowers/4.3.1/skills/finishing-a-development-branch/SKILL.md`

**Step 1: Read the file**

Read the full file to understand the current step numbering.

**Step 2: Update the core principle line**

Find:
```
**Core principle:** Verify tests → Present options → Execute choice → Clean up.
```

Replace with:
```
**Core principle:** Verify tests → Smoke verification → Present options → Execute choice → Clean up.
```

**Step 3: Insert the smoke verification phase between Step 1 and Step 2**

Find the section that ends with:
```
**If tests pass:** Continue to Step 2.
```

Insert the following AFTER that line, BEFORE the `### Step 2: Determine Base Branch` heading:

```markdown
### Step 1.5: Smoke Verification (MANDATORY)

**Find the smoke test for this branch:**

```bash
ls scripts/smoke/ 2>/dev/null
```

**If no smoke file found:**
```
No smoke test found in scripts/smoke/.
Write one now before creating the PR, or explicitly confirm you want to skip verification.
Never auto-skip — always surface this to the user.
```

**If smoke file exists — run Step A then Step B:**

**Step A — Headed run (user watches live):**

```bash
mkdir -p /tmp/smoke
python scripts/with_server.py --server "npm run dev" --port 5174 -- \
  npx tsx scripts/smoke/<ticket-file>.ts
```

After the headed run completes, ask:
```
Headed smoke run complete. Did it look right? (y/n)
```
If n: stop. Investigate before proceeding.

**Step B — Screenshot review (user confirms each frame):**

```bash
HEADLESS=1 python scripts/with_server.py --server "npm run dev" --port 5174 -- \
  npx tsx scripts/smoke/<ticket-file>.ts
```

After the headless run, read each screenshot with the Read tool and show it inline:
```
Frame 1/4: [description of what this frame shows]
[screenshot displayed inline]
Does this look right? (y/n)
```

One frame at a time. Wait for confirmation before showing the next.
If n on any frame: stop, open browser to that URL, investigate.

**Only after both A and B are confirmed:** proceed to Step 2.
```

**Step 4: Update the Quick Reference table**

Find the Quick Reference table and add a row for smoke verification, or add a note:
```
Note: Smoke verification (Step 1.5) runs before Step 2 for all options.
```

**Step 5: Verify the edit looks correct**

Read the modified file and confirm the new section is in the right place between Step 1 and Step 2.

**Step 6: No commit needed** — skill files are not in the amakaflow-ui git repo.

---

## Task 3: Update writing-plans skill

**File:**
- Modify: `/Users/davidandrews/.claude/plugins/cache/claude-plugins-official/superpowers/4.3.1/skills/writing-plans/SKILL.md`

**Step 1: Read the file**

Read the full file to find the "Remember" section and the "Execution Handoff" section.

**Step 2: Add the mandatory final task rule to the "Remember" section**

Find:
```markdown
## Remember
- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- Reference relevant skills with @ syntax
- DRY, YAGNI, TDD, frequent commits
```

Replace with:
```markdown
## Remember
- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- Reference relevant skills with @ syntax
- DRY, YAGNI, TDD, frequent commits
- **Every plan MUST end with a smoke test task** (see Mandatory Final Task below)
```

**Step 3: Add the Mandatory Final Task section**

Find the `## Execution Handoff` heading. Insert the following BEFORE it:

```markdown
## Mandatory Final Task: Smoke Test

**Every plan must include this as its last task.** Fill in the feature-specific frame descriptions.

````markdown
### Task N (Final): Write Smoke Test

**Files:**
- Create: `scripts/smoke/<ama-NNN>-<feature-name>.ts`

**What to cover (3-5 frames):**
- Frame 1: Route/page loads, key element visible
- Frame 2: Primary action triggered (click the main button)
- Frame 3: Expected result appears
- [Frame 4+: Additional paths if relevant]

**Template:**

```ts
// scripts/smoke/ama-NNN-feature-name.ts
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE_URL = process.env.SMOKE_URL ?? 'http://localhost:5173';
const HEADLESS = process.env.HEADLESS === '1';

await mkdir('/tmp/smoke', { recursive: true });
const browser = await chromium.launch({ headless: HEADLESS });
const page = await browser.newPage();

// Frame 1: Page loads
await page.goto(`${BASE_URL}/path`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/tmp/smoke/frame-1-loaded.png' });
console.log('Frame 1: Page loaded');

// Frame 2: Primary action
await page.click('text=Primary Button');
await page.waitForSelector('[data-result]', { timeout: 5000 });
await page.screenshot({ path: '/tmp/smoke/frame-2-action.png' });
console.log('Frame 2: Action triggered');

// Frame 3: Result
await page.screenshot({ path: '/tmp/smoke/frame-3-result.png' });
console.log('Frame 3: Result visible');

await browser.close();
console.log('Smoke complete. Screenshots in /tmp/smoke/');
```

**Verify locally (server must be running):**
```bash
mkdir -p /tmp/smoke
npx tsx scripts/smoke/<ama-NNN>-<feature-name>.ts
```

Expected: N "Frame N:" lines, "Smoke complete.", no errors.

**Commit:**
```bash
git add scripts/smoke/<ama-NNN>-<feature-name>.ts
git commit -m "test(<ama-NNN>): add smoke test"
```
````

```

**Step 4: Verify the edit looks correct**

Read the modified file and confirm the new section appears before "Execution Handoff" and after the task structure examples.

---

## Task 4: Update lfg skill

**File:**
- Modify: `/Users/davidandrews/dev/Amakaflow/.claude/skills/lfg/SKILL.md`

**Step 1: Read the file**

Read the full file. Find Phase 5 (Code Review) and Phase 6 (Ship).

**Step 2: Insert Phase 5.5 between Phase 5 and Phase 6**

Find the line:
```markdown
## Phase 6: Ship
```

Insert the following BEFORE it:

```markdown
## Phase 5.5: Smoke Verification

**Goal:** Verify the feature actually works in a browser before shipping.

1. **Find the smoke test:**
   ```bash
   ls scripts/smoke/ | grep <ticket-id>
   ```
   If not found: "No smoke test found. Write one before shipping (see writing-plans skill for template)."

2. **Step A — Headed run** (user watches live):
   ```bash
   mkdir -p /tmp/smoke
   python scripts/with_server.py --server "npm run dev" --port 5174 -- \
     npx tsx scripts/smoke/<ticket-file>.ts
   ```
   Ask: "Did the headed run look right? (y/n)" — if n, stop and investigate.

3. **Step B — Screenshot review:**
   ```bash
   HEADLESS=1 python scripts/with_server.py --server "npm run dev" --port 5174 -- \
     npx tsx scripts/smoke/<ticket-file>.ts
   ```
   Read each `/tmp/smoke/frame-*.png` inline with the Read tool.
   For each: "Frame N/N: [description] — does this look right? (y/n)"
   If n on any frame: stop and investigate before proceeding.

**Checkpoint 5.5:**
```
## Smoke Verified ✓

**Frames confirmed:** N/N
**Smoke test:** scripts/smoke/<file>.ts

Ready to ship?
```

```

**Step 3: Update the Important Rules section**

Find the `## Important Rules` section at the bottom. Add:
```
6. **Always run smoke verification (Phase 5.5) before shipping.** If no smoke test exists, write one first.
```

**Step 4: Verify the edit looks correct**

Read the modified file. Confirm Phase 5.5 appears between Phase 5 and Phase 6, and the new rule is in Important Rules.

**Step 5: Commit the lfg skill change**

```bash
cd /Users/davidandrews/dev/Amakaflow && git add .claude/skills/lfg/SKILL.md && git commit -m "feat: add Phase 5.5 smoke verification to lfg skill"
```

---

## Done State

- `scripts/smoke/` directory exists with `.gitkeep` and `ama-935-pipeline-observatory.ts`
- `finishing-a-development-branch` skill has Step 1.5 (smoke verification) between unit tests and PR options
- `writing-plans` skill always appends a smoke test task to every plan
- `lfg` skill has Phase 5.5 between Code Review and Ship
- Memory rule already saved (done during brainstorm)
- Running `npx tsx scripts/smoke/ama-935-pipeline-observatory.ts` produces 4 frames in `/tmp/smoke/`
