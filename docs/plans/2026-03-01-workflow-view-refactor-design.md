# WorkflowView Refactor — Domain Hook Split Design

**Date:** 2026-03-01
**Status:** Approved — ready for implementation
**Approach:** Option B — split by domain into 3 focused hooks + thin composer

---

## Problem

`WorkflowView.tsx` is 1,493 lines with 24 `useState` declarations and ~20 inlined handler functions. It violates the project's own architecture rule ("Components render. Hooks orchestrate.") — it fetches, orchestrates complex state, and renders JSX all in one file. This makes it untestable, hard to navigate, and every new feature requires editing the same massive file.

The Import feature is the reference implementation that already follows the correct pattern. This refactor applies that same pattern to `WorkflowView`.

---

## Approach

**Before:**
```
WorkflowView.tsx  ← 1,493 lines, 24 useState, 20 handlers, all JSX
```

**After:**
```
WorkflowView.tsx (~150 lines)          ← JSX only, calls useWorkflowState()
src/app/useWorkflowState.ts (~100 lines)     ← thin composer
src/app/hooks/useWorkflowGeneration.ts (~200 lines)
src/app/hooks/useWorkflowEditing.ts (~150 lines)
src/app/hooks/useWorkflowValidation.ts (~200 lines)
src/app/hooks/__tests__/               ← renderHook() tests per domain hook
```

---

## Hook Responsibilities

### `useWorkflowGeneration`

**Receives:** `userId`, `selectedDevice`, `onWorkoutGenerated(workout)`, `onStepChange`, `onViewChange`

**Owns state:**
- `sources`, `loading`, `generationProgress`, `generationAbortController`, `apiAvailable`
- `showStravaEnhance`, `pinterestBulkModal`, `welcomeDismissed`, `buildTimestamp`

**Handles:**
- `handleGenerateStructure` — main AI generation flow
- `handleCancelGeneration` — abort in-flight request
- `handleLoadTemplate` — load a preset template
- `handleCreateNew` — blank workout creation
- `handleStartNew` — reset and go to add-sources step
- `handleWelcomeDismiss` — persist welcome guide dismissal to localStorage
- `handlePinterestBulkImport` / `handlePinterestEditSingle` / `handlePinterestBulkClose`
- `handleBack` — step navigation (structure → add-sources)

---

### `useWorkflowEditing`

**Receives:** `userId`, `setWorkout`, `setWorkoutSaved`, `onStepChange`, `onViewChange`, `workout`, `workoutSaved`, `importProcessedItems`, `setImportProcessedItems`

**Owns state:**
- `isEditingFromHistory`, `isCreatingFromScratch`, `isEditingFromImport`
- `editingWorkoutId`, `editingImportQueueId`, `selectedProgramId`

**Handles:**
- `handleLoadFromHistory` — load a past workout for viewing
- `handleEditFromHistory` — open a past workout in StructureWorkout
- `handleBulkDeleteWorkouts` — delete selected history items
- `onEditWorkout(queueId, workout)` — enter edit mode from ImportScreen
- `handleBackToImport` — auto-save edited workout into importProcessedItems and navigate back

---

### `useWorkflowValidation`

**Receives:** `workout`, `userId`, `selectedDevice`, `setWorkout`, `onStepChange`, `stravaConnected`

**Owns state:**
- `validation: ValidationResponse | null`
- `exports: ExportFormats | null`

**Handles:**
- `handleAutoMap` — auto-map exercise names
- `handleValidate` — run full validation
- `handleReValidate` — re-validate after manual edits
- `handleProcess` — process workout with validation results
- All device export handlers

---

### `useWorkflowState` (composer)

Owns the bridge state shared across hooks:
- `workout: WorkoutStructure | null`
- `workoutSaved: boolean`
- `currentStep: WorkflowStep`
- `confirmDialog` — generic confirm modal state
- `workoutTypeDialog` — workout type detection modal state

Calls all three domain hooks, passes bridge state as inputs/callbacks, returns everything merged. `WorkflowView` calls only this one hook.

---

## Data Flow

```
User action → useWorkflowGeneration.handleGenerateStructure()
  → API call → onWorkoutGenerated(result)
    → composer sets workout
      → useWorkflowValidation receives workout (re-renders)
        → user clicks Validate → useWorkflowValidation.handleValidate()
```

Data flows one way. No circular dependencies between domain hooks.

---

## Testing Strategy

Each domain hook gets its own `renderHook()` test file. API clients are mocked at the boundary (`vi.mock('../lib/api')`). No JSX rendered in any hook test.

**`useWorkflowGeneration.test.ts`**
- `loading` transitions correctly during generation
- `workout` is set on success via `onWorkoutGenerated` callback
- Abort resets loading state and clears progress

**`useWorkflowEditing.test.ts`**
- `isEditingFromHistory` / `isEditingFromImport` toggle correctly
- `handleBackToImport` updates `importProcessedItems` before navigating

**`useWorkflowValidation.test.ts`**
- `validation` and `exports` populated on success
- Error state set correctly on API failure

---

## Files

### Created
| File | Est. lines |
|------|-----------|
| `src/app/hooks/useWorkflowGeneration.ts` | ~200 |
| `src/app/hooks/useWorkflowEditing.ts` | ~150 |
| `src/app/hooks/useWorkflowValidation.ts` | ~200 |
| `src/app/hooks/__tests__/useWorkflowGeneration.test.ts` | ~80 |
| `src/app/hooks/__tests__/useWorkflowEditing.test.ts` | ~60 |
| `src/app/hooks/__tests__/useWorkflowValidation.test.ts` | ~80 |
| `src/app/useWorkflowState.ts` | ~100 |

### Modified
| File | Change |
|------|--------|
| `src/app/WorkflowView.tsx` | 1,493 → ~150 lines: delete all state + handlers, call `useWorkflowState()`, keep JSX |

### Untouched
Everything else — Import hooks, lib/, components/, tests.

---

## Acceptance Criteria

- [ ] `WorkflowView.tsx` is ≤ 200 lines
- [ ] No `useState`, `useEffect`, or `handle*` functions remain in `WorkflowView.tsx`
- [ ] All three domain hook test files exist with passing tests
- [ ] `npm run build` passes
- [ ] Existing test suite passes (`npm test`)
- [ ] App behaviour is identical — this is a pure refactor, no UX changes

---

## Repo
`amakaflow-ui` — single repo change, no backend or mobile changes needed.
