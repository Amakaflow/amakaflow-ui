# Phase 4 — Core Component Refactor Design

**Date:** 2026-03-01
**Status:** Approved — ready for implementation
**Approach:** Option B — relocate into feature directories, extract hooks

---

## Problem

Three core components still violate the project's architecture rule ("Components render. Hooks orchestrate."):

| Component | Lines | `useState` | Handlers |
|-----------|-------|------------|---------|
| `UnifiedWorkouts.tsx` | 1,647 | 28 | 45 total |
| `StructureWorkout.tsx` | 1,553 | 18 | 22 total |
| `PublishExport.tsx` | 1,273 | 14 | 19 total |

These are flat files in `src/components/` doing all three jobs (state, logic, rendering) just like `WorkflowView.tsx` did before AMA-865.

---

## Approach — Relocate into feature directories

Apply the same pattern already established by Import (`src/components/Import/hooks/`):

```
Before:
  src/components/StructureWorkout.tsx   ← 1,553 lines, 18 useState
  src/components/UnifiedWorkouts.tsx    ← 1,647 lines, 28 useState
  src/components/PublishExport.tsx      ← 1,273 lines, 14 useState

After:
  src/components/StructureWorkout/
    hooks/
      useStructureWorkout.ts            ← all state + handlers
      __tests__/
        useStructureWorkout.test.ts     ← renderHook() tests
    StructureWorkout.tsx                ← pure JSX, ~150 lines

  src/components/Workouts/              ← renamed from UnifiedWorkouts
    hooks/
      useWorkoutList.ts                 ← all state + handlers
      __tests__/
        useWorkoutList.test.ts          ← renderHook() tests
    WorkoutList.tsx                     ← pure JSX, ~150 lines

  src/components/PublishExport/
    hooks/
      usePublishExport.ts               ← all state + handlers
      __tests__/
        usePublishExport.test.ts        ← renderHook() tests
    PublishExport.tsx                   ← pure JSX, ~150 lines
```

Each component becomes a self-contained feature directory, consistent with `Import/`, `Home/`, `ExerciseHistory/`, `ProgramDetail/`.

---

## Why feature directories over in-place hooks

- Adding a new sub-component (e.g., a WorkoutCard detail panel) has an obvious home
- Hook test files don't clutter the root `src/components/` folder
- Consistent with the Import pattern already in use
- Long-term: each feature directory is an isolated unit — easy to understand, refactor, or delete

---

## Renaming

`UnifiedWorkouts.tsx` → `src/components/Workouts/WorkoutList.tsx`

The old name is an implementation detail ("Unified" referred to merging history + programs). The new name describes what it does: list workouts. Router and all import paths updated accordingly.

---

## Public API

**No props interface changes.** Each component's `props` stay identical — this is a pure internal refactor. No UX changes, no API contract changes.

---

## Order of work

1. **StructureWorkout** (most central — used in WorkflowView's structure step)
2. **Workouts / UnifiedWorkouts** (largest file, most state)
3. **PublishExport** (export step, self-contained)

Each gets its own feature branch and PR.

---

## Testing strategy

Each hook gets `renderHook()` tests (same pattern as `useWorkflowGeneration`, `useWorkflowEditing`):
- State transitions on key handler calls
- API calls mocked at the boundary
- No JSX rendered in hook tests

---

## Files

### Ticket 1: StructureWorkout

| Action | File |
|--------|------|
| Create | `src/components/StructureWorkout/hooks/useStructureWorkout.ts` |
| Create | `src/components/StructureWorkout/hooks/__tests__/useStructureWorkout.test.ts` |
| Create | `src/components/StructureWorkout/StructureWorkout.tsx` (~150 lines) |
| Delete | `src/components/StructureWorkout.tsx` |
| Update | `src/app/router.tsx` — update import path |
| Update | `src/app/WorkflowView.tsx` — update import path |

### Ticket 2: Workouts (UnifiedWorkouts rename)

| Action | File |
|--------|------|
| Create | `src/components/Workouts/hooks/useWorkoutList.ts` |
| Create | `src/components/Workouts/hooks/__tests__/useWorkoutList.test.ts` |
| Create | `src/components/Workouts/WorkoutList.tsx` (~150 lines) |
| Delete | `src/components/UnifiedWorkouts.tsx` |
| Update | `src/app/router.tsx` — rename `UnifiedWorkouts` export to `WorkoutList` |
| Update | `src/app/WorkflowView.tsx` — update import + usage |

### Ticket 3: PublishExport

| Action | File |
|--------|------|
| Create | `src/components/PublishExport/hooks/usePublishExport.ts` |
| Create | `src/components/PublishExport/hooks/__tests__/usePublishExport.test.ts` |
| Create | `src/components/PublishExport/PublishExport.tsx` (~150 lines) |
| Delete | `src/components/PublishExport.tsx` |
| Update | `src/app/router.tsx` — update import path |
| Update | `src/app/WorkflowView.tsx` — update import path |

---

## Acceptance criteria (per ticket)

- [ ] Old flat file deleted
- [ ] New hook file has ≤0 `useState` in the component TSX
- [ ] Component TSX is ≤ 200 lines
- [ ] `renderHook()` tests cover key state transitions
- [ ] `npm run build` passes
- [ ] Existing test suite passes
- [ ] App behaviour identical — pure refactor, no UX changes

---

## Repo

`amakaflow-ui` — single repo changes, no backend or mobile changes.
