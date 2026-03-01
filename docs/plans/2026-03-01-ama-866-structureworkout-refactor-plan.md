# AMA-866: StructureWorkout Refactor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract 13 useState + all handlers from `StructureWorkout.tsx` into `useStructureWorkout.ts`, move `SortableExercise` and `SortableBlock` into separate files, and rewrite `StructureWorkout.tsx` as a thin JSX shell (~150 lines).

**Architecture:** Follow the Import pattern (`src/components/Import/hooks/useImportFlow.ts`). Create `src/components/StructureWorkout/` directory with `hooks/useStructureWorkout.ts`, `SortableExercise.tsx`, `SortableBlock.tsx`, and a thin `StructureWorkout.tsx`. Delete the old flat file. Update only `WorkflowView.tsx` (StructureWorkout is not in router.tsx).

**Tech Stack:** React, TypeScript, @dnd-kit/core, @dnd-kit/sortable, Vitest + @testing-library/react (renderHook), existing project patterns.

---

## Pre-flight: Read the design doc

Before starting, read:
- `docs/plans/2026-03-01-phase4-core-component-refactor-design.md`
- `src/components/Import/hooks/useImportFlow.ts` (reference implementation)
- `src/app/WorkflowView.tsx` lines 238-268 (how StructureWorkout is called)

---

### Task 1: Create directory scaffold and move types

**Files:**
- Create: `src/components/StructureWorkout/hooks/useStructureWorkout.ts` (empty stub)
- Create: `src/components/StructureWorkout/hooks/__tests__/useStructureWorkout.test.ts` (empty stub)
- Create: `src/components/StructureWorkout/SortableExercise.tsx` (empty stub)
- Create: `src/components/StructureWorkout/SortableBlock.tsx` (empty stub)
- Create: `src/components/StructureWorkout/StructureWorkout.tsx` (empty stub)

**Step 1: Create the directory structure**

```bash
mkdir -p src/components/StructureWorkout/hooks/__tests__
```

**Step 2: Create stub files**

Create `src/components/StructureWorkout/hooks/useStructureWorkout.ts`:
```typescript
// TODO: implement
export {};
```

Create `src/components/StructureWorkout/hooks/__tests__/useStructureWorkout.test.ts`:
```typescript
// TODO: implement
```

Create `src/components/StructureWorkout/SortableExercise.tsx`:
```typescript
// TODO: implement
export {};
```

Create `src/components/StructureWorkout/SortableBlock.tsx`:
```typescript
// TODO: implement
export {};
```

Create `src/components/StructureWorkout/StructureWorkout.tsx`:
```typescript
// TODO: implement
export {};
```

**Step 3: Verify build still passes (old flat file still in place)**

Run: `npm run build`
Expected: SUCCESS — no errors (we haven't broken anything yet)

**Step 4: Commit**

```bash
git add src/components/StructureWorkout/
git commit -m "chore(AMA-866): scaffold StructureWorkout feature directory"
```

---

### Task 2: Extract SortableExercise into its own file

**Files:**
- Modify: `src/components/StructureWorkout/SortableExercise.tsx`
- Read: `src/components/StructureWorkout.tsx` lines 1-230 (imports + SortableExercise component)

SortableExercise is a pure component that uses `useSortable` from @dnd-kit/sortable. It has no local state of its own. It receives all exercise data via props.

**Step 1: Write the failing test**

In `src/components/StructureWorkout/hooks/__tests__/useStructureWorkout.test.ts`:
```typescript
import { render, screen } from '@testing-library/react';
import { SortableExercise } from '../SortableExercise';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';

// Minimal exercise for testing render
const exercise = {
  id: 'ex-1',
  name: 'Squat',
  sets: 3,
  reps: '10',
  weight: '',
  notes: '',
  rpe: undefined,
  duration: undefined,
  distance: undefined,
  rest: undefined,
  category: undefined,
  equipment: undefined,
  side: undefined,
  alternatives: [],
  validationStatus: undefined,
  mappedExerciseId: undefined,
  originalName: undefined,
};

it('renders exercise name', () => {
  render(
    <DndContext>
      <SortableContext items={['ex-1']}>
        <SortableExercise
          exercise={exercise}
          exerciseId="ex-1"
          blockIdx={0}
          exerciseIdx={0}
          supersetIdx={undefined}
          loading={false}
          onEdit={() => {}}
          onDelete={() => {}}
          onUpdate={() => {}}
        />
      </SortableContext>
    </DndContext>
  );
  expect(screen.getByText('Squat')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/StructureWorkout/hooks/__tests__/useStructureWorkout.test.ts`
Expected: FAIL — `SortableExercise` not yet implemented

**Step 3: Implement SortableExercise.tsx**

Copy the `SortableExercise` component (lines ~124-230 in the old `StructureWorkout.tsx`) into `src/components/StructureWorkout/SortableExercise.tsx`. Add the necessary imports from the old file. Export as named export:

```typescript
// src/components/StructureWorkout/SortableExercise.tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { Exercise } from '../../types/workout';

interface SortableExerciseProps {
  exercise: Exercise;
  exerciseId: string;
  blockIdx: number;
  exerciseIdx: number;
  supersetIdx?: number;
  loading: boolean;
  onEdit: (blockIdx: number, exerciseIdx: number, supersetIdx?: number) => void;
  onDelete: (blockIdx: number, exerciseIdx: number, supersetIdx?: number) => void;
  onUpdate: (blockIdx: number, exerciseIdx: number, field: string, value: unknown, supersetIdx?: number) => void;
}

export function SortableExercise({ ... }: SortableExerciseProps) {
  // Copy exact implementation from old file
}
```

> NOTE: Copy the EXACT implementation from `src/components/StructureWorkout.tsx` lines ~124-230. Do not rewrite it — it has been battle-tested and the E2E tests validate its behavior.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/StructureWorkout/hooks/__tests__/useStructureWorkout.test.ts`
Expected: PASS

**Step 5: Verify build**

Run: `npm run build`
Expected: SUCCESS

**Step 6: Commit**

```bash
git add src/components/StructureWorkout/SortableExercise.tsx src/components/StructureWorkout/hooks/__tests__/useStructureWorkout.test.ts
git commit -m "feat(AMA-866): extract SortableExercise into own file"
```

---

### Task 3: Extract SortableBlock into its own file

**Files:**
- Modify: `src/components/StructureWorkout/SortableBlock.tsx`
- Read: `src/components/StructureWorkout.tsx` lines 232-770 (SortableBlock component)

SortableBlock has its own local state: `isCollapsed`, `showConfig`, `collapsedSupersets`, `showDeleteConfirm`. These are UI-local state and stay in this file. It uses the important `useRef` + `useEffect` pattern for `collapseSignal` to avoid infinite re-renders from @dnd-kit creating new object references.

**Step 1: Write the failing test**

Add to `useStructureWorkout.test.ts`:

```typescript
import { SortableBlock } from '../SortableBlock';

const block = {
  id: 'block-1',
  name: 'Main Block',
  exercises: [],
  supersets: [],
  notes: '',
  type: 'main' as const,
};

it('renders block name', () => {
  render(
    <DndContext>
      <SortableContext items={['block-1']}>
        <SortableBlock
          block={block}
          blockId="block-1"
          blockIdx={0}
          loading={false}
          collapseSignal={undefined}
          selectedDevice="garmin"
          onEditExercise={() => {}}
          onDeleteExercise={() => {}}
          onUpdateExercise={() => {}}
          onAddExercise={() => {}}
          onAddSuperset={() => {}}
          onDeleteSuperset={() => {}}
          onUpdateBlock={() => {}}
          onDeleteBlock={() => {}}
          onEditBlock={() => {}}
        />
      </SortableContext>
    </DndContext>
  );
  expect(screen.getByText('Main Block')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/StructureWorkout/hooks/__tests__/useStructureWorkout.test.ts`
Expected: FAIL — `SortableBlock` not yet implemented

**Step 3: Implement SortableBlock.tsx**

Copy the `SortableBlock` component (lines ~232-770 in the old `StructureWorkout.tsx`) into `src/components/StructureWorkout/SortableBlock.tsx`.

Key things to preserve exactly:
1. The `useRef` pattern for `supersets` inside the `useEffect` (prevents @dnd-kit re-renders from triggering collapse effect):
```typescript
const supersetsRef = useRef(block.supersets);
useEffect(() => { supersetsRef.current = block.supersets; }, [block.supersets]);
useEffect(() => {
  if (!collapseSignal) return;
  const { action } = collapseSignal;
  if (action === 'collapse-all') { /* ... */ }
  if (action === 'expand-all') { /* ... */ }
}, [collapseSignal]); // <-- supersetsRef NOT in deps, intentionally
```

2. The `SortableExercise` import now comes from `./SortableExercise` (same directory):
```typescript
import { SortableExercise } from './SortableExercise';
```

**Step 4: Run tests**

Run: `npx vitest run src/components/StructureWorkout/hooks/__tests__/useStructureWorkout.test.ts`
Expected: PASS

**Step 5: Verify build**

Run: `npm run build`
Expected: SUCCESS

**Step 6: Commit**

```bash
git add src/components/StructureWorkout/SortableBlock.tsx
git commit -m "feat(AMA-866): extract SortableBlock into own file"
```

---

### Task 4: Implement useStructureWorkout hook

**Files:**
- Modify: `src/components/StructureWorkout/hooks/useStructureWorkout.ts`
- Read: `src/components/StructureWorkout.tsx` lines 711-1200 (state declarations + all handlers)

The hook extracts all 13 `useState` declarations and all named handler functions. `workoutWithIds` (useMemo) also moves into the hook.

**Step 1: Write the failing tests**

Replace the contents of `useStructureWorkout.test.ts` with a focused hook test file:

```typescript
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useStructureWorkout } from '../useStructureWorkout';
import type { WorkoutStructure } from '../../../../types/workout';

const makeWorkout = (): WorkoutStructure => ({
  title: 'Test Workout',
  description: '',
  blocks: [
    {
      id: 'block-1',
      name: 'Warmup',
      type: 'warmup',
      exercises: [
        { id: 'ex-1', name: 'Jog', sets: 1, reps: '5min', weight: '', notes: '', alternatives: [] },
      ],
      supersets: [],
    },
  ],
});

const defaultProps = {
  workout: makeWorkout(),
  onWorkoutChange: vi.fn(),
  selectedDevice: 'garmin' as const,
  userSelectedDevices: ['garmin' as const],
};

describe('useStructureWorkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initialises with all state false/null', () => {
    const { result } = renderHook(() => useStructureWorkout(defaultProps));
    expect(result.current.showWorkoutSettings).toBe(false);
    expect(result.current.editingExercise).toBeNull();
    expect(result.current.editingBlockIdx).toBeNull();
    expect(result.current.showExerciseSearch).toBe(false);
    expect(result.current.addingToBlock).toBeNull();
    expect(result.current.jsonCopied).toBe(false);
    expect(result.current.showAddBlockPicker).toBe(false);
    expect(result.current.activeDragItem).toBeNull();
  });

  it('updateExercise calls onWorkoutChange with updated exercise', () => {
    const onWorkoutChange = vi.fn();
    const { result } = renderHook(() =>
      useStructureWorkout({ ...defaultProps, onWorkoutChange })
    );

    act(() => {
      result.current.updateExercise(0, 0, 'sets', 5);
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.blocks[0].exercises[0].sets).toBe(5);
  });

  it('deleteExercise calls onWorkoutChange with exercise removed', () => {
    const onWorkoutChange = vi.fn();
    const { result } = renderHook(() =>
      useStructureWorkout({ ...defaultProps, onWorkoutChange })
    );

    act(() => {
      result.current.deleteExercise(0, 0);
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.blocks[0].exercises).toHaveLength(0);
  });

  it('addBlock calls onWorkoutChange with new block appended', () => {
    const onWorkoutChange = vi.fn();
    const { result } = renderHook(() =>
      useStructureWorkout({ ...defaultProps, onWorkoutChange })
    );

    act(() => {
      result.current.addBlock('main');
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.blocks).toHaveLength(2);
    expect(updated.blocks[1].type).toBe('main');
  });

  it('deleteBlock calls onWorkoutChange with block removed', () => {
    const onWorkoutChange = vi.fn();
    const { result } = renderHook(() =>
      useStructureWorkout({ ...defaultProps, onWorkoutChange })
    );

    act(() => {
      result.current.deleteBlock(0);
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.blocks).toHaveLength(0);
  });

  it('collapseSignal is set on collapse-all', () => {
    const { result } = renderHook(() => useStructureWorkout(defaultProps));

    act(() => {
      result.current.collapseAll();
    });

    expect(result.current.collapseSignal?.action).toBe('collapse-all');
  });

  it('collapseSignal is set on expand-all', () => {
    const { result } = renderHook(() => useStructureWorkout(defaultProps));

    act(() => {
      result.current.expandAll();
    });

    expect(result.current.collapseSignal?.action).toBe('expand-all');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/StructureWorkout/hooks/__tests__/useStructureWorkout.test.ts`
Expected: FAIL — `useStructureWorkout` not yet implemented

**Step 3: Implement useStructureWorkout.ts**

The hook signature:

```typescript
interface UseStructureWorkoutProps {
  workout: WorkoutStructure;
  onWorkoutChange: (w: WorkoutStructure) => void;
  selectedDevice: DeviceId;
  userSelectedDevices: DeviceId[];
}

export function useStructureWorkout({
  workout,
  onWorkoutChange,
  selectedDevice,
  userSelectedDevices,
}: UseStructureWorkoutProps) {
  // 13 useState declarations
  const [showWorkoutSettings, setShowWorkoutSettings] = useState(false);
  const [editingExercise, setEditingExercise] = useState<...>(null);
  const [editingBlockIdx, setEditingBlockIdx] = useState<number | null>(null);
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [addingToBlock, setAddingToBlock] = useState<number | null>(null);
  const [addingToSuperset, setAddingToSuperset] = useState<...>(null);
  const [collapseSignal, setCollapseSignal] = useState<...>(undefined);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [showAddBlockPicker, setShowAddBlockPicker] = useState(false);
  const [skippedWarmup, setSkippedWarmup] = useState(false);
  const [skippedCooldown, setSkippedCooldown] = useState(false);
  const [skippedRest, setSkippedRest] = useState(false);
  const [activeDragItem, setActiveDragItem] = useState<...>(null);

  // workoutWithIds useMemo — copy exact deps serialization pattern
  const workoutWithIds = useMemo(() => { ... }, [JSON.stringify(workout.blocks)]);

  // All handlers: updateExercise, deleteExercise, addExercise, addSuperset,
  // deleteSuperset, addBlock, updateBlock, deleteBlock, handleWorkoutSettingsSave,
  // handleDragStart, handleDragEnd, collapseAll, expandAll

  return {
    // state
    showWorkoutSettings, setShowWorkoutSettings,
    editingExercise, setEditingExercise,
    editingBlockIdx, setEditingBlockIdx,
    showExerciseSearch, setShowExerciseSearch,
    addingToBlock, setAddingToBlock,
    addingToSuperset, setAddingToSuperset,
    collapseSignal,
    jsonCopied, setJsonCopied,
    showAddBlockPicker, setShowAddBlockPicker,
    skippedWarmup, skippedCooldown, skippedRest,
    activeDragItem,
    workoutWithIds,
    // handlers
    updateExercise,
    deleteExercise,
    addExercise,
    addSuperset,
    deleteSuperset,
    addBlock,
    updateBlock,
    deleteBlock,
    handleWorkoutSettingsSave,
    handleDragStart,
    handleDragEnd,
    collapseAll: () => setCollapseSignal({ action: 'collapse-all', timestamp: Date.now() }),
    expandAll: () => setCollapseSignal({ action: 'expand-all', timestamp: Date.now() }),
  };
}
```

Copy handlers verbatim from `src/components/StructureWorkout.tsx` lines 800-1100. The only change: handlers that called `setWorkout(...)` now call `onWorkoutChange(...)`.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/StructureWorkout/hooks/__tests__/useStructureWorkout.test.ts`
Expected: 7 tests PASS

**Step 5: Verify build**

Run: `npm run build`
Expected: SUCCESS

**Step 6: Commit**

```bash
git add src/components/StructureWorkout/hooks/
git commit -m "feat(AMA-866): implement useStructureWorkout hook with tests"
```

---

### Task 5: Rewrite StructureWorkout.tsx as thin shell

**Files:**
- Create: `src/components/StructureWorkout/StructureWorkout.tsx` (replacing stub)
- Read: `src/components/StructureWorkout.tsx` lines 1100-1553 (JSX rendering portion)

The new `StructureWorkout.tsx` in the feature directory:
- Imports `useStructureWorkout` from `./hooks/useStructureWorkout`
- Imports `SortableBlock` from `./SortableBlock`
- Imports `SortableExercise` from `./SortableExercise`
- Contains ONLY JSX + prop destructuring — zero useState, zero useEffect, zero handlers
- Target: ≤ 200 lines

The props interface (`StructureWorkoutProps`) stays on the component file (it's the public API):

```typescript
// src/components/StructureWorkout/StructureWorkout.tsx
import { useStructureWorkout } from './hooks/useStructureWorkout';
import { SortableBlock } from './SortableBlock';
// ... other imports

export interface StructureWorkoutProps {
  workout: WorkoutStructure;
  onWorkoutChange: (w: WorkoutStructure) => void;
  onAutoMap: () => void;
  onValidate: () => void;
  onSave?: () => void;
  isEditingFromHistory?: boolean;
  isCreatingFromScratch?: boolean;
  hideExport?: boolean;
  loading: boolean;
  selectedDevice: DeviceId;
  onDeviceChange: (d: DeviceId) => void;
  userSelectedDevices: DeviceId[];
  onNavigateToSettings?: () => void;
}

export function StructureWorkout(props: StructureWorkoutProps) {
  const {
    workout, onWorkoutChange, onAutoMap, onValidate, onSave,
    isEditingFromHistory, isCreatingFromScratch, hideExport,
    loading, selectedDevice, onDeviceChange, userSelectedDevices,
    onNavigateToSettings,
  } = props;

  const {
    showWorkoutSettings, setShowWorkoutSettings,
    editingExercise, setEditingExercise,
    editingBlockIdx, setEditingBlockIdx,
    // ... all state and handlers
  } = useStructureWorkout({ workout, onWorkoutChange, selectedDevice, userSelectedDevices });

  return (
    // JSX only — copy from old file, no logic changes
  );
}
```

**Step 1: Verify file length after writing**

Run: `wc -l src/components/StructureWorkout/StructureWorkout.tsx`
Expected: ≤ 200 lines

**Step 2: Verify build still passes (old flat file still present)**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Run existing tests**

Run: `npm test`
Expected: All existing tests pass

**Step 4: Commit**

```bash
git add src/components/StructureWorkout/StructureWorkout.tsx
git commit -m "feat(AMA-866): rewrite StructureWorkout as thin JSX shell"
```

---

### Task 6: Cut over imports and delete old flat file

**Files:**
- Modify: `src/app/WorkflowView.tsx` — update import path
- Delete: `src/components/StructureWorkout.tsx` (the old flat file)

**Step 1: Update WorkflowView.tsx import**

In `src/app/WorkflowView.tsx`, change:
```typescript
// Before
import { StructureWorkout } from '../components/StructureWorkout';

// After
import { StructureWorkout } from '../components/StructureWorkout/StructureWorkout';
```

**Step 2: Verify no other files import from the old path**

Run: `grep -r "from.*components/StructureWorkout'" src/`
Expected: Only the old flat file itself (which we're about to delete). No other consumers.

**Step 3: Delete the old flat file**

```bash
rm src/components/StructureWorkout.tsx
```

**Step 4: Verify build passes**

Run: `npm run build`
Expected: SUCCESS — no missing imports

**Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 6: Verify new component line count**

Run: `wc -l src/components/StructureWorkout/StructureWorkout.tsx`
Expected: ≤ 200

Run: `wc -l src/components/StructureWorkout/hooks/useStructureWorkout.ts`
Expected: present and reasonable (~250-350 lines)

**Step 7: Check for useState in the new component TSX**

Run: `grep -c "useState" src/components/StructureWorkout/StructureWorkout.tsx`
Expected: 0

**Step 8: Commit**

```bash
git add src/app/WorkflowView.tsx
git rm src/components/StructureWorkout.tsx
git commit -m "feat(AMA-866): cut over to feature directory, delete old flat file"
```

---

### Task 7: Final verification and PR

**Step 1: Run the full E2E test suite against the dev server**

Start dev server if not running:
```bash
# In a separate terminal (demo mode):
cp .env.demo .env.local
npm run dev -- --port 3030
```

Run Playwright tests:
```bash
python e2e/test_workflow_refactor.py
```
Expected: 24/24 tests pass

**Step 2: Run unit tests one final time**

Run: `npm test`
Expected: All pass

**Step 3: Acceptance criteria checklist**

```
- [ ] Old flat file deleted: src/components/StructureWorkout.tsx gone
- [ ] Component TSX has 0 useState: grep confirms 0
- [ ] Component TSX is ≤ 200 lines: wc -l confirms
- [ ] renderHook() tests cover key state transitions: 7 tests pass
- [ ] npm run build passes
- [ ] Existing test suite passes
- [ ] E2E tests: 24/24 pass
- [ ] App behaviour identical — pure refactor, no UX changes
```

**Step 4: Create PR**

```bash
gh pr create \
  --title "feat(AMA-866): refactor StructureWorkout into feature directory" \
  --body "$(cat <<'EOF'
## Summary
- Extracts 13 useState + all handlers from StructureWorkout.tsx into useStructureWorkout.ts
- Moves SortableExercise and SortableBlock into separate files in the feature directory
- Rewrites StructureWorkout.tsx as a thin JSX shell (≤200 lines, 0 useState)
- Deletes old src/components/StructureWorkout.tsx (was 1,553 lines)

## Test Plan
- [ ] npm test passes (unit + hook tests)
- [ ] npm run build passes
- [ ] E2E: python e2e/test_workflow_refactor.py → 24/24

Closes AMA-866
EOF
)"
```

**Step 5: Monitor CI**

```bash
gh pr checks --watch
```
Expected: All checks green

---

## Reference

### State declarations to extract (13 useState)

From `src/components/StructureWorkout.tsx` lines 771-788:

| State | Type | Initial |
|-------|------|---------|
| `showWorkoutSettings` | `boolean` | `false` |
| `editingExercise` | `{blockIdx, exerciseIdx, supersetIdx?} \| null` | `null` |
| `editingBlockIdx` | `number \| null` | `null` |
| `showExerciseSearch` | `boolean` | `false` |
| `addingToBlock` | `number \| null` | `null` |
| `addingToSuperset` | `{blockIdx, supersetIdx} \| null` | `null` |
| `collapseSignal` | `{action, timestamp} \| undefined` | `undefined` |
| `jsonCopied` | `boolean` | `false` |
| `showAddBlockPicker` | `boolean` | `false` |
| `skippedWarmup` | `boolean` | `false` |
| `skippedCooldown` | `boolean` | `false` |
| `skippedRest` | `boolean` | `false` |
| `activeDragItem` | `{type, label} \| null` | `null` |

### Handlers to extract

From `src/components/StructureWorkout.tsx` lines 800-1100:
- `handleDragStart(event)` — sets `activeDragItem`
- `handleDragEnd(event)` — calls `arrayMove`, updates blocks, clears `activeDragItem`
- `updateExercise(blockIdx, exerciseIdx, field, value, supersetIdx?)` — calls `onWorkoutChange`
- `deleteExercise(blockIdx, exerciseIdx, supersetIdx?)` — calls `onWorkoutChange`
- `addExercise(blockIdx, exercise, supersetIdx?)` — calls `onWorkoutChange`
- `addSuperset(blockIdx)` — calls `onWorkoutChange`
- `deleteSuperset(blockIdx, supersetIdx)` — calls `onWorkoutChange`
- `addBlock(type)` — calls `onWorkoutChange`
- `updateBlock(blockIdx, field, value)` — calls `onWorkoutChange`
- `deleteBlock(blockIdx)` — calls `onWorkoutChange`
- `handleWorkoutSettingsSave(settings)` — calls `onWorkoutChange`

### Files NOT changed

- `src/app/router.tsx` — StructureWorkout is NOT in router (direct import only)
- All other component files
- All lib/ files
- No backend changes

### Import path after refactor

```typescript
// WorkflowView.tsx
import { StructureWorkout } from '../components/StructureWorkout/StructureWorkout';
```
