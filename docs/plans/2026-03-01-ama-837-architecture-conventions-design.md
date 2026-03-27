# Phase 3 — Architecture Conventions Design

**Date:** 2026-03-01
**Status:** Approved — ready for implementation
**Linear:** AMA-837
**Approach:** `ARCHITECTURE.md` in repo root + Notion page; Linear ticket for the implementation task

---

## Problem

Phases 1 and 2 established the patterns — `App.tsx` decomposed, Import screen as the reference implementation. Without documentation those patterns live only in commit history and in David's head. Phase 3 locks them in so they stay consistent as the codebase grows.

---

## Deliverables

1. **`ARCHITECTURE.md`** — in `amakaflow-ui/` root, ~150 lines, the in-repo quick reference
2. **Notion page** — mirror with richer formatting + cross-links to Linear, phase design docs, and the Notion React UI Architecture page
3. **Linear ticket AMA-837** — implementation task, links to the Notion page

---

## Document Structure

### `ARCHITECTURE.md`

```
1. Guiding principle          (2 sentences)
2. Decision tree              (quick-lookup cheat sheet)
3. The layers                 (one paragraph + one real file per layer)
4. Worked example             (Import/ annotated)
5. Adding a new screen        (numbered recipe)
6. PR checklist               (copy-paste for review)
```

Target: ~150 lines. Short enough to read in one sitting, useful enough to reach for daily.

---

## Content

### Guiding principle

> **Components render. Hooks orchestrate. `lib/` fetches.**

### Decision tree

```
Where does this code go?

Is it a pure function or data transform?       → src/lib/
Is it an API call?                             → src/lib/<domain>-api.ts
Is it stateful logic or side effects?
  Global (auth, history, keyboard shortcuts)?  → src/app/
  Feature-scoped?                              → src/components/<Feature>/hooks/
Is it JSX?                                     → src/components/<Feature>/<Feature>.tsx
```

### The layers

| Layer | Rule | Example |
|---|---|---|
| `src/lib/` | Pure functions and API calls. No React, no state. | `src/lib/bulk-import-api.ts` |
| `src/components/<Feature>/hooks/` | Stateful logic and side effects. No JSX. | `src/components/Import/hooks/useImportFlow.ts` |
| `src/components/<Feature>/` | JSX only. No API calls, no business logic. | `src/components/Import/ImportScreen.tsx` |
| `src/app/` | Global cross-cutting concerns (auth, routing, keyboard shortcuts). | `src/app/useAppAuth.ts` |

### Worked example — Import screen

```
src/components/Import/
  hooks/
    useImportQueue.ts       ← queue state + URL/file parsing (no JSX)
    useImportProcessing.ts  ← API calls, per-item status (no JSX)
    useImportFlow.ts        ← phase state machine, orchestrates the two above (no JSX)
    __tests__/              ← renderHook() tests, no DOM required
  ImportScreen.tsx          ← thin shell: calls useImportFlow, renders tabs (< 80 lines)
  FileImportTab.tsx         ← presentation only: no API calls, no business logic
  ImportQueue.tsx           ← presentation only
  ProcessingView.tsx        ← presentation only
  ResultsScreen.tsx         ← presentation only
  BlockPicker.tsx           ← presentation only
```

Every future screen follows this structure. Adding a new import source (e.g. Notion tab) means adding a tab component and wiring it into `useImportFlow` — no changes to `ImportScreen.tsx`.

### Adding a new screen

1. Create `src/components/<Feature>/hooks/use<Feature>.ts` — logic first, no JSX
2. Write tests with `renderHook()` from `@testing-library/react` — no DOM, no rendering the screen
3. Create `src/components/<Feature>/<Feature>.tsx` — thin shell, calls only `use<Feature>`
4. Add one line to `src/app/router.tsx`

### PR checklist

```
- [ ] No fetch / axios / supabase calls inside a component
- [ ] No domain state derived inline — comes from a hook
- [ ] New screen added in one line in router.tsx
- [ ] Hook has renderHook() tests that don't render the full screen
```

---

## Notion page

Mirror of `ARCHITECTURE.md` with:
- Richer section formatting (callout blocks for the guiding principle and checklist)
- Links to: Linear AMA-835, AMA-836, AMA-837; phase design docs in `docs/plans/`; the existing React UI Architecture Notion page
- Created as a sub-page under the existing React UI Architecture Notion page

---

## Success Criteria

- [ ] `ARCHITECTURE.md` exists in `amakaflow-ui/` root and is linked from `README.md`
- [ ] Notion page created under React UI Architecture, cross-linked to Linear
- [ ] Linear AMA-837 ticket created, links to Notion page
- [ ] `README.md` updated to point to `ARCHITECTURE.md`
