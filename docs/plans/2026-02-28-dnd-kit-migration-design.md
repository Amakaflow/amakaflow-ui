# @dnd-kit Migration Design: True Positional Drag-and-Drop for StructureWorkout

**Date:** 2026-02-28
**Author:** David Andrews
**Status:** Approved — ready for implementation

---

## Problem

`StructureWorkout.tsx` uses `react-dnd` with a broken positional drop: `ExerciseDropZone` always appends exercises to the end of the list (`targetIdx = exercises.length`) regardless of where the user drops. Block reordering works but exercise reordering does not respect drop position. There is no visual drag ghost during drag.

The codebase already has `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` installed, and `BlockDetailEditor.tsx` / `DroppableSuperset.tsx` already use them as a reference pattern.

---

## Goals

- True positional drag-and-drop for **blocks** within the workout
- True positional drag-and-drop for **exercises within each block** (including supersets)
- True positional drag-and-drop for **exercises within each superset**
- Visual drag ghost (`DragOverlay`) during all drag operations
- Correct state preservation: collapse state, superset nesting, block IDs do not reset
- Remove `react-dnd` and `react-dnd-html5-backend` as dependencies

---

## Architecture

### DnD Context Hierarchy

```
DndContext (workout-level, single instance)
  └── SortableContext (blocks — vertical list)
       ├── SortableBlock
       │    └── SortableContext (block exercises — vertical list)
       │         ├── SortableExercise
       │         └── DroppableSuperset (existing)
       │              └── SortableContext (superset exercises — vertical list)
       │                   └── SortableExercise
       └── DragOverlay (rendered outside SortableContexts)
```

### Draggable Item Data Shape

Each draggable item carries a `data` payload used by the single `onDragEnd` handler to resolve context without DOM traversal:

```typescript
type DraggableData =
  | { type: 'block'; blockIdx: number }
  | { type: 'exercise'; blockIdx: number; exerciseIdx: number; supersetIdx: null }
  | { type: 'superset-exercise'; blockIdx: number; supersetIdx: number; exerciseIdx: number };
```

The `id` for each item is the stable UUID already assigned by `addIdsToWorkout` (blocks: `block.id`, exercises: `exercise.id`).

### Single `onDragEnd` Handler

Replaces `handleBlockDrop` + `handleExerciseDrop`. Logic:

1. Look up `active.data.current` and `over.data.current`
2. If types differ → no-op (prevent cross-container drops at wrong level)
3. If `type === 'block'` → `arrayMove(blocks, oldIdx, newIdx)`
4. If `type === 'exercise'` or `'superset-exercise'` → `arrayMove(exercises, oldIdx, newIdx)` within the correct container, then rebuild workout immutably via `cloneWorkout`

### `onDragOver` for Live Preview

Enables smooth cross-container preview (e.g., dragging an exercise between supersets) by swapping items in a local `workoutDraft` state that is reset on `onDragEnd`.

---

## Key Implementation Notes

- `useSortable({ id })` on each `DraggableBlock` and `DraggableExercise`
- `SortableContext` receives `items` as the array of stable string IDs
- `DragOverlay` renders a non-interactive copy of the dragged item
- Existing `cloneWorkout` / `cloneBlock` / `cloneSuperset` / `cloneExercise` helpers are preserved — they are the correct pattern
- `collapsedSupersets` state lives inside `DraggableBlock` and is keyed on `block.id` — collapse state is preserved automatically through re-renders
- `workoutWithIds` useMemo is preserved; dependency array correctly detects all structural changes
- `DroppableSuperset.tsx` already uses `@dnd-kit` — it becomes a `SortableContext` wrapper

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/StructureWorkout.tsx` | Full migration: remove react-dnd, add DndContext + SortableContext + useSortable + DragOverlay |
| `src/components/DroppableSuperset.tsx` | Minor: ensure SortableContext wraps superset exercises |
| `package.json` | Remove `react-dnd`, `react-dnd-html5-backend` |

---

## What Is NOT Changing

- All existing non-DnD UI (block editing, exercise editing, collapse/expand, add exercise, settings dialogs)
- `cloneWorkout` / `cloneBlock` / `cloneSuperset` / `cloneExercise` helper functions
- `addIdsToWorkout` and `workoutWithIds` useMemo
- All exercise set/rep/weight editing logic
- The existing Playwright E2E test suite (`/tmp/test_structure_workout.py`) — tests must continue to pass

---

## Success Criteria

- [ ] Blocks can be reordered to any position by dragging
- [ ] Exercises within a block can be reordered to any position by dragging
- [ ] Exercises within a superset can be reordered by dragging
- [ ] Drag ghost (DragOverlay) appears during drag for all item types
- [ ] Collapse/expand state of supersets is preserved after reorder
- [ ] No console errors during any drag operation
- [ ] All 55 Playwright E2E tests pass
- [ ] `react-dnd` and `react-dnd-html5-backend` removed from `package.json`

---

## Reference Implementation

`BlockDetailEditor.tsx` contains a working pattern: `DndContext` → `SortableContext` → `useSortable` → `arrayMove` on `onDragEnd`. Use this as the model.

`DroppableSuperset.tsx` already imports from `@dnd-kit/core` and `@dnd-kit/sortable` — coordinate with its existing API.
