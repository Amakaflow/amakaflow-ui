# Workout Edit, Mix & Import Preview — UI Design

**Goal:** Three new UI surfaces that connect to the already-live backend endpoints (`POST /workouts/{id}/operations`, `POST /workouts/mix`, `POST /import/preview/operations`).

**Architecture:** Shared editing primitives composed into surface-specific wrappers. No single mega-component with mode flags; no duplicated exercise/block UI either.

**Tech Stack:** React, TypeScript, existing component patterns in `amakaflow-ui` (bottom sheets, modals, `BulkImport` step shell).

---

## Architecture

```
src/components/
├── WorkoutEditor/
│   ├── primitives/
│   │   ├── ExerciseRow.tsx       — single exercise: inline rename, delete, drag handle
│   │   ├── BlockSection.tsx      — block header + ExerciseRow list + reorder
│   │   └── WorkoutEditorCore.tsx — BlockSection list, accumulates ops array (pure controlled)
│   ├── WorkoutEditSheet.tsx      — Quick Edit: fetches workout, POST /workouts/{id}/operations, optimistic lock
│   └── WorkoutEditorInline.tsx   — Inline variant: takes workoutData + onOpsApplied prop (no fetch)
├── MixWizard/
│   ├── MixWizardModal.tsx        — Full-screen wizard shell (3 steps)
│   ├── SelectWorkoutsStep.tsx    — Pick source workouts from library
│   ├── SelectBlocksStep.tsx      — Per-workout block picker
│   └── MixPreviewStep.tsx        — Preview result; WorkoutEditorInline + POST /workouts/mix
└── BulkImport/
    └── PreviewStep.tsx           — existing; gains per-workout <WorkoutEditorInline> toggle
```

**Key principle:** `WorkoutEditorCore` is a pure controlled component — takes `initialWorkout`, exposes `ops[]` via callback. It never calls the API. The two wrappers decide when and how to persist.

---

## Feature 1: Quick Edit

**Entry points:**
- Swipe-right action on workout card in `UnifiedWorkouts.tsx`
- "Edit" button inside `ViewWorkout.tsx` modal

**UX:**
- Opens as a bottom sheet (matches existing `WorkoutDetail.tsx` sheet pattern)
- Shows `WorkoutEditorCore` with all operations: rename workout, rename/delete/reorder exercises, delete/reorder blocks
- Ops accumulate locally while editing — no API calls mid-session

**Save flow:**
```
open sheet → load workout (store updated_at)
user edits → ops[] accumulates locally
Save tapped → POST /workouts/{id}/operations { ops, expected_updated_at }
200 → dismiss + refresh workout list
409 → conflict banner: "Workout was updated elsewhere — Reload?" (discards local ops)
422 → highlight failed operation inline ("Exercise not found")
network error → toast + sheet stays open (ops preserved)
```

---

## Feature 2: Mix Workouts Wizard

**Entry point:** FAB on workout list ("Mix" icon, bottom-right)

**Steps:**

1. **Select Workouts** — searchable list from library, tap to add (up to ~5 sources)
2. **Select Blocks** — accordion per source workout, checkbox per block; must select ≥1 block to proceed
3. **Preview & Save** — calls `POST /workouts/mix` on step mount; merged result shown via `WorkoutEditorInline` for optional cleanup; title field at top; "Save" creates workout via existing save endpoint

**Navigation:** Back/forward between steps; wizard dismisses on save. On save: new workout created, originals untouched.

**Step 3 call timing:** `POST /workouts/mix` fires when the user reaches step 3 (not on save), so preview is ready immediately. If they navigate back and change block selection, the call re-fires on return to step 3.

**Error handling:**
- Step 3 load failure: error state with "Retry" button
- Save failure: toast + stays on step 3

---

## Feature 3: Preview-Step Inline Editing

**Context:** User is on `PreviewStep` in the import flow, reviewing detected workouts before executing.

**UX:**
- Each workout card gains an "Edit" chevron button
- Tapping expands `WorkoutEditorInline` below the card summary
- Workouts the user doesn't touch remain collapsed — no visual noise
- On any op: fires `POST /import/preview/operations` immediately (cache update, no DB write)
- Collapse re-shows updated summary (exercise count, block count reflect edits)

**Error handling:**
- Op failure: inline error on the affected card only; does not block the rest of the import flow

---

## Data Flow Summary

| Surface | API | When called | Failure behavior |
|---------|-----|-------------|-----------------|
| Quick Edit save | `POST /workouts/{id}/operations` | On "Save" tap | 409 → reload CTA; 422 → inline highlight; network → toast |
| Mix step 3 | `POST /workouts/mix` | On step 3 mount | Error state + Retry |
| Import preview op | `POST /import/preview/operations` | On each op immediately | Inline card error |

---

## Testing Plan

**Unit tests (Vitest + React Testing Library)**
- `WorkoutEditorCore`: accumulates correct ops array per operation type; validates bounds before adding op
- `WorkoutEditSheet`: 409 renders reload CTA; 422 highlights failed op; success dismisses sheet
- `MixWizardModal`: step navigation; step 3 fires POST `/workouts/mix` on mount; save calls creation endpoint
- `WorkoutEditorInline`: dispatches `POST /import/preview/operations` on each op; updated preview replaces card state

**E2E (Maestro)**
- Quick edit from list: swipe → rename exercise → save → list reflects new name
- Mix wizard: FAB → select 2 workouts → 1 block each → preview shows 2 blocks → save → new workout in list
- Import preview edit: reach preview step → expand workout → rename exercise → execute import → imported workout has renamed exercise

**Mocking:** All API calls mocked via fetch mocks (matching existing `BulkImport` test pattern). Backend already tested; UI tests focus on state transitions and render correctness.
