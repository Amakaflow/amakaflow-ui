# Phase 3 — Architecture Conventions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Write `ARCHITECTURE.md` in the `amakaflow-ui/` root, create a matching Notion page, and update `README.md` to link to both.

**Architecture:** Documentation-only phase. No code changes. `ARCHITECTURE.md` is the in-repo quick reference (~150 lines). The Notion page mirrors the content with cross-links to Linear tickets and the existing React UI Architecture Notion page. Both are created on a feature branch and merged via PR.

**Tech Stack:** Markdown, Notion API (via MCP), Linear (via MCP), GitHub CLI (`gh`)

---

## Context

The design is approved and saved at `docs/plans/2026-03-01-ama-837-architecture-conventions-design.md`. Read it before starting. All content decisions are already made — this plan is purely execution.

The reference implementation to annotate in the worked example is `src/components/Import/` (merged in PR #179).

**Branch strategy:** Create a feature branch off `develop`. All changes go through a PR — never commit directly to `develop`.

---

### Task 1: Set up the feature branch

**Files:**
- No files changed — branch setup only

**Step 1: Pull latest develop and create the feature branch**

```bash
cd /Users/davidandrews/dev/AmakaFlow/amakaflow-ui
git checkout develop
git pull origin develop
git checkout -b feat/ama-837-architecture-conventions
```

**Step 2: Verify the branch**

```bash
git branch --show-current
```

Expected output: `feat/ama-837-architecture-conventions`

**Step 3: Confirm the Import/ directory exists (the worked example)**

```bash
ls src/components/Import/
```

Expected: `BlockPicker.tsx  ClipQueueTab.tsx  FileImportTab.tsx  ImportQueue.tsx  ImportScreen.tsx  IntegrationsTab.tsx  ProcessingView.tsx  ResultsScreen.tsx  hooks/  index.ts`

---

### Task 2: Write `ARCHITECTURE.md`

**Files:**
- Create: `ARCHITECTURE.md` (repo root)

**Step 1: Create the file with this exact content**

```markdown
# Architecture

> **Components render. Hooks orchestrate. `lib/` fetches.**

---

## Decision Tree

```
Where does this code go?

Is it a pure function or data transform?        → src/lib/
Is it an API call?                              → src/lib/<domain>-api.ts
Is it stateful logic or side effects?
  Global (auth, history, keyboard shortcuts)?   → src/app/
  Feature-scoped?                               → src/components/<Feature>/hooks/
Is it JSX?                                      → src/components/<Feature>/<Feature>.tsx
```

---

## The Layers

### `src/lib/` — Pure functions and API calls

No React, no state. If it can be called from a Node script, it belongs here.

**Example:** `src/lib/bulk-import-api.ts` — all HTTP calls to the workout ingestor API.

### `src/components/<Feature>/hooks/` — Stateful logic and side effects

No JSX. Hooks own state machines, API call orchestration, and side effects. They are tested with `renderHook()` — no DOM required.

**Example:** `src/components/Import/hooks/useImportFlow.ts` — phase state machine that orchestrates `useImportQueue` and `useImportProcessing`.

### `src/components/<Feature>/` — JSX only

No API calls. No business logic. Components receive data and callbacks from a hook and render them. All state comes from a hook or is local UI state (`isOpen`, `isDragOver`).

**Example:** `src/components/Import/ImportScreen.tsx` — 79 lines, calls only `useImportFlow`, renders the current phase.

### `src/app/` — Global cross-cutting concerns

Auth, routing, keyboard shortcuts. Things that every view needs but no single feature owns.

**Example:** `src/app/useAppAuth.ts` — Clerk session watcher + Supabase profile sync.

---

## Worked Example — Import Screen

```
src/components/Import/
  hooks/
    useImportQueue.ts       ← queue state, URL parsing, file type detection
    useImportProcessing.ts  ← API calls, per-item status, retry
    useImportFlow.ts        ← phase state machine, orchestrates the two above
    __tests__/              ← renderHook() tests — no DOM, no ImportScreen render
  ImportScreen.tsx          ← thin shell: calls useImportFlow, renders tabs (79 lines)
  FileImportTab.tsx         ← presentation only: drag-drop zone, calls onFilesDetected
  ImportQueue.tsx           ← presentation only
  ProcessingView.tsx        ← presentation only
  ResultsScreen.tsx         ← presentation only
  BlockPicker.tsx           ← presentation only
  index.ts                  ← re-exports ImportScreen
```

**How a new import source (e.g. Notion) would be added:**
1. Add a `NotionTab.tsx` presentation component
2. Wire it into `useImportFlow` (add a handler that calls `addUrls`)
3. Add the tab to `ImportScreen.tsx`
4. `ImportScreen.tsx` itself does not change its structure

**How to test the import flow:**
```typescript
const { result } = renderHook(() => useImportFlow({ userId, onDone, onEditWorkout }));
act(() => result.current.addUrls('https://example.com'));
await act(async () => result.current.handleImport());
expect(result.current.phase).toBe('results');
```

---

## Adding a New Screen

1. Create `src/components/<Feature>/hooks/use<Feature>.ts` — logic first, no JSX
2. Write `renderHook()` tests — no DOM, no rendering the screen
3. Create `src/components/<Feature>/<Feature>.tsx` — thin shell, imports only `use<Feature>`
4. Add one line to `src/app/router.tsx`:
   ```typescript
   export const MyScreen = lazy(() => import('../components/MyFeature').then(m => ({ default: m.MyScreen })));
   ```
5. Reference `MyScreen` in `src/app/WorkflowView.tsx`

---

## PR Checklist

Before merging any screen-level change:

- [ ] No `fetch`, `axios`, or `supabase` calls inside a component
- [ ] No domain state derived inline — comes from a hook
- [ ] New screen added in one line in `router.tsx`
- [ ] Hook has `renderHook()` tests that don't render the full screen
- [ ] `ImportScreen` serves as the reference — ask: "does this look like Import/?"

---

## Reference

- **Phase 1 (App.tsx decompose):** `src/app/` — `AppShell.tsx`, `useAppAuth.ts`, `useWorkoutHistory.ts`, `router.tsx`
- **Phase 2 (Import hooks):** `src/components/Import/` — the canonical reference implementation
- **Design docs:** `docs/plans/2026-03-01-react-architecture-strangler-fig.md`
- **Notion:** [React UI Architecture](https://www.notion.so/react-ui-architecture) ← update this link after Task 3
```

**Step 2: Verify line count**

```bash
wc -l ARCHITECTURE.md
```

Expected: ~100 lines (under 150 — if it's over, trim prose, not content).

**Step 3: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs(arch): add ARCHITECTURE.md — decision tree, layers, Import worked example"
```

---

### Task 3: Update `README.md`

**Files:**
- Modify: `README.md` — add Architecture link near the top

**Step 1: Read the current README.md**

Open `README.md` and find the `## Quick Links` section.

**Step 2: Add the Architecture link**

Add one line to the Quick Links section:

```markdown
- [Architecture Guide](./ARCHITECTURE.md)
```

Place it as the **first** item in Quick Links — it's the most relevant for a developer starting work.

**Step 3: Verify**

```bash
grep "ARCHITECTURE" README.md
```

Expected: `- [Architecture Guide](./ARCHITECTURE.md)`

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: link ARCHITECTURE.md from README quick links"
```

---

### Task 4: Create the Notion page

**Files:**
- No files changed — Notion API call only

**Step 1: Find the parent Notion page**

The parent is the existing "React UI Architecture" Notion page. Its URL is: `https://www.notion.so/316bd1f0c9c481baa243fe6c7dbcfb37` (from the AMA-836 Notion page created in Phase 2 brainstorm — use the MCP Notion tool to find the correct parent).

Search for the parent page:
- Use `mcp__notion__notion-search` with query `"React UI Architecture"`
- Identify the correct page ID

**Step 2: Create the sub-page**

Use `mcp__notion__notion-create-pages` to create a new page under the React UI Architecture parent with:

- Title: `Architecture Conventions — ARCHITECTURE.md (AMA-837)`
- Content: Mirror of `ARCHITECTURE.md` — paste the full content as Notion blocks
  - Use a **callout block** for the guiding principle ("Components render. Hooks orchestrate...")
  - Use **code blocks** for the decision tree and worked example
  - Use **bulleted list** for the PR checklist
  - Add a **divider** before the Reference section
  - Add links to: Linear AMA-837, AMA-835, AMA-836; the design docs in GitHub

**Step 3: Copy the Notion page URL**

After creation, note the URL. You'll add it to the Linear ticket in Task 5.

---

### Task 5: Create Linear AMA-837 ticket and link everything

**Step 1: Find the Linear team**

Use `mcp__linear__list_teams` to find the correct team ID.

**Step 2: Create the Linear ticket**

Use `mcp__linear__save_issue` to create:

- **Title:** `Phase 3 — Architecture conventions (ARCHITECTURE.md + Notion page)`
- **Description:**
  ```
  Document the UI architecture patterns established in Phase 1 (AMA-835) and Phase 2 (AMA-836).

  ## Deliverables
  - [x] ARCHITECTURE.md in amakaflow-ui/ root
  - [x] README.md updated with link
  - [x] Notion page created under React UI Architecture
  - [ ] PR merged to develop

  ## Links
  - Notion: <paste URL from Task 4>
  - Design doc: docs/plans/2026-03-01-ama-837-architecture-conventions-design.md
  - Phase 1: AMA-835
  - Phase 2: AMA-836
  ```
- **Status:** In Progress

**Step 3: Note the ticket ID**

The Linear ticket should be AMA-837 — confirm after creation.

---

### Task 6: Push and create PR

**Step 1: Push the branch**

```bash
git push -u origin feat/ama-837-architecture-conventions
```

**Step 2: Create the PR**

```bash
gh pr create --title "docs(arch): Phase 3 — ARCHITECTURE.md + Notion page (AMA-837)" --body "$(cat <<'EOF'
## Summary

- Adds `ARCHITECTURE.md` to the repo root — decision tree, layer descriptions, Import screen worked example, new-screen recipe, PR checklist
- Updates `README.md` to link to `ARCHITECTURE.md` as the first Quick Link
- Notion page created under React UI Architecture (linked in AMA-837)

## What this documents

The patterns established in:
- AMA-835 (Phase 1): `src/app/` — AppShell, useAppAuth, useWorkoutHistory, router
- AMA-836 (Phase 2): `src/components/Import/` — the canonical reference implementation

## Linear

AMA-837

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 3: Verify the PR is open**

```bash
gh pr view --web
```

---

## Success Criteria

- [ ] `ARCHITECTURE.md` exists in repo root, < 150 lines
- [ ] `README.md` links to `ARCHITECTURE.md` in Quick Links (first item)
- [ ] Notion page created under React UI Architecture, URL noted in Linear AMA-837
- [ ] Linear AMA-837 ticket created, links to Notion page and design doc
- [ ] PR open against `develop`, build passes
