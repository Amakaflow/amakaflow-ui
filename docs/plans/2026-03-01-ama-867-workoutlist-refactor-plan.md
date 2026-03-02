# AMA-867: UnifiedWorkouts → WorkoutList Refactor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract 27 useState + all handlers/effects from `UnifiedWorkouts.tsx` into `useWorkoutList.ts`, rename the component to `WorkoutList`, relocate into `src/components/Workouts/`, and delete `src/components/UnifiedWorkouts.tsx`.

**Architecture:** Same pattern as AMA-866 (StructureWorkout) and Import. No sub-components exist in this file — the extraction is purely state/handlers → hook, JSX stays in the thin shell. The rename (`UnifiedWorkouts` → `WorkoutList`) requires updating `router.tsx` (lazy import path + export name) and `WorkflowView.tsx` (JSX tag name + import).

**Tech Stack:** React 18, TypeScript, Vite, Vitest + @testing-library/react (renderHook), existing project patterns.

---

## Key facts from code inventory

- **27 useState + 1 useRef** in the main function (no sub-components)
- **4 useCallback** data-loading functions: `loadWorkouts`, `loadTags`, `loadCompletions`, `loadMoreCompletions`
- **4 useEffect**: trigger loaders on mount, open pending edit after modal closes
- **3 useMemo**: `availablePlatforms`, `availableCategories`, `filteredWorkouts`
- **~17 named handlers**: selection, delete, favorite, edit, load, view, export, tags
- **Dead props**: `onBulkDeleteWorkouts` and `onDeleteWorkout` are declared in the interface but never called internally — keep them in the interface (public API contract, no props changes)
- **Router entry**: `src/app/router.tsx` lazy-loads `UnifiedWorkouts` — needs path + name update
- **WorkflowView**: imports `UnifiedWorkouts` from `./router`, uses `<UnifiedWorkouts ...>` tag

---

## Tasks

### Task 1: Create directory scaffold

**Files:**
- Create: `src/components/Workouts/hooks/useWorkoutList.ts` (stub)
- Create: `src/components/Workouts/hooks/__tests__/useWorkoutList.test.ts` (stub)
- Create: `src/components/Workouts/WorkoutList.tsx` (stub)

**Step 1: Create directories**
```bash
mkdir -p src/components/Workouts/hooks/__tests__
```

**Step 2: Create stubs**

`src/components/Workouts/hooks/useWorkoutList.ts`:
```typescript
// TODO: implement
export {};
```

`src/components/Workouts/hooks/__tests__/useWorkoutList.test.ts`:
```typescript
// TODO: implement
```

`src/components/Workouts/WorkoutList.tsx`:
```typescript
// TODO: implement
export {};
```

**Step 3: Verify build passes (old flat file still in place)**
```bash
npm run build 2>&1 | tail -3
```
Expected: SUCCESS

**Step 4: Commit**
```bash
git add src/components/Workouts/
git commit -m "chore(AMA-867): scaffold Workouts feature directory"
```

---

### Task 2: Implement useWorkoutList hook with tests

**Files:**
- Modify: `src/components/Workouts/hooks/useWorkoutList.ts`
- Modify: `src/components/Workouts/hooks/__tests__/useWorkoutList.test.ts`
- Read first: `src/components/UnifiedWorkouts.tsx` lines 102-800 (props + all state + handlers)

**Hook interface:**
```typescript
interface UseWorkoutListProps {
  profileId: string;
  onEditWorkout: (item: WorkoutHistoryItem) => void;
  onLoadWorkout: (item: WorkoutHistoryItem) => void;
  onDeleteWorkout: (id: string) => void;
  onBulkDeleteWorkouts?: (ids: string[]) => Promise<void> | void;
  onViewProgram?: (programId: string) => void;
}
```

**What to extract — copy verbatim from `UnifiedWorkouts.tsx`:**

1. **Module-level pure helpers** (lines ~115-163): `formatDate`, `getDeviceIcon`, `getSourceIcon`, `getSourceLabel` — move into hook file (or keep at module level in hook file)

2. **All 27 useState + 1 useRef** (lines ~178-224):
   - `isLoading`, `error`, `allWorkouts`, `viewMode`, `searchQuery`
   - `sourceFilter`, `platformFilter`, `categoryFilter`, `syncFilter`, `sortOption`
   - `pageIndex`, `selectedIds`, `showDeleteModal`, `pendingDeleteIds`
   - `confirmDeleteId`, `deletingId`, `viewingWorkout`, `editingWorkout`
   - `tagFilter`, `availableTags`, `showTagManagement`, `showMixWizard`
   - `showActivityHistory`, `completions`, `completionsLoading`, `completionsTotal`
   - `selectedCompletionId`
   - `pendingEditRef` (useRef)

3. **All 4 useCallback** (lines ~227-289): `loadWorkouts`, `loadTags`, `loadCompletions`, `loadMoreCompletions`

4. **All 4 useEffect** (lines ~246-303)

5. **All 3 useMemo** (lines ~306-387): `availablePlatforms`, `availableCategories`, `filteredWorkouts`

6. **All named handlers** (lines ~396-790): `toggleSelect`, `toggleSelectAll`, `clearSelection`, `handleBulkDeleteClick`, `confirmBulkDelete`, `cancelBulkDelete`, `handleDeleteClick`, `handleDeleteConfirm`, `handleDeleteCancel`, `handleFavoriteToggle`, `handleTagsUpdate`, `handleEdit`, `handleLoad`, `handleView`, `handleEditWorkout`, `handleCsvExport`, `handleApiExport`, `handleLoadUnified`

7. **Derived constant** `isAllSelected` (line ~402)

**Import path adjustments** (new file at `src/components/Workouts/hooks/useWorkoutList.ts`):
- `../../../lib/export-api` (was `../lib/export-api`)
- `../../../types/unified-workout` (was `../types/unified-workout`)
- `../../../lib/workout-filters` (was `../lib/workout-filters`)
- `../../../lib/unified-workouts` (was `../lib/unified-workouts`)
- `../../../lib/workout-history` (was `../lib/workout-history`)
- `../../../lib/workout-api` (was `../lib/workout-api`)
- `../../../lib/follow-along-api` (was `../lib/follow-along-api`)
- `../../../lib/completions-api` (was `../lib/completions-api`)

**Step 1: Write failing tests first**

```typescript
// useWorkoutList.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useWorkoutList } from '../useWorkoutList';

// Mock all API modules
vi.mock('../../../../lib/unified-workouts', () => ({
  fetchAllWorkouts: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../../lib/workout-api', () => ({
  getUserTags: vi.fn().mockResolvedValue([]),
  toggleWorkoutFavorite: vi.fn(),
  updateWorkoutTags: vi.fn(),
  saveWorkoutToAPI: vi.fn(),
}));
vi.mock('../../../../lib/completions-api', () => ({
  fetchWorkoutCompletions: vi.fn().mockResolvedValue({ completions: [], total: 0 }),
}));
vi.mock('../../../../lib/workout-history', () => ({
  deleteWorkoutFromHistory: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../../lib/follow-along-api', () => ({
  deleteFollowAlong: vi.fn().mockResolvedValue(undefined),
}));

const defaultProps = {
  profileId: 'user-1',
  onEditWorkout: vi.fn(),
  onLoadWorkout: vi.fn(),
  onDeleteWorkout: vi.fn(),
};

describe('useWorkoutList', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('initialises with loading state and empty workouts', async () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    // isLoading starts true
    expect(result.current.isLoading).toBe(true);
    expect(result.current.allWorkouts).toEqual([]);
    // after load completes
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('toggleSelect adds an id to selectedIds', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.toggleSelect('w-1'); });
    expect(result.current.selectedIds).toContain('w-1');
  });

  it('toggleSelect removes an already-selected id', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.toggleSelect('w-1'); });
    act(() => { result.current.toggleSelect('w-1'); });
    expect(result.current.selectedIds).not.toContain('w-1');
  });

  it('clearSelection resets selectedIds to empty', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.toggleSelect('w-1'); });
    act(() => { result.current.clearSelection(); });
    expect(result.current.selectedIds).toHaveLength(0);
  });

  it('handleDeleteClick sets confirmDeleteId', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.handleDeleteClick('w-42'); });
    expect(result.current.confirmDeleteId).toBe('w-42');
  });

  it('handleDeleteCancel clears confirmDeleteId', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.handleDeleteClick('w-42'); });
    act(() => { result.current.handleDeleteCancel(); });
    expect(result.current.confirmDeleteId).toBeNull();
  });

  it('handleBulkDeleteClick sets pendingDeleteIds and shows modal', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.handleBulkDeleteClick(['w-1', 'w-2']); });
    expect(result.current.pendingDeleteIds).toEqual(['w-1', 'w-2']);
    expect(result.current.showDeleteModal).toBe(true);
  });

  it('cancelBulkDelete clears pending state and hides modal', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.handleBulkDeleteClick(['w-1']); });
    act(() => { result.current.cancelBulkDelete(); });
    expect(result.current.showDeleteModal).toBe(false);
    expect(result.current.pendingDeleteIds).toHaveLength(0);
  });

  it('viewMode defaults to compact and can be changed', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    expect(result.current.viewMode).toBe('compact');
    act(() => { result.current.setViewMode('cards'); });
    expect(result.current.viewMode).toBe('cards');
  });
});
```

**Step 2: Run to verify FAIL**
```bash
npx vitest run src/components/Workouts/hooks/__tests__/useWorkoutList.test.ts --reporter=verbose 2>&1 | tail -10
```
Expected: FAIL (hook not implemented)

**Step 3: Implement useWorkoutList.ts**

Copy all state, hooks, and handlers from `UnifiedWorkouts.tsx` verbatim. Adjust import paths. Export the hook with all state + handlers in its return object.

**Step 4: Run to verify PASS**
```bash
npx vitest run src/components/Workouts/hooks/__tests__/useWorkoutList.test.ts --reporter=verbose 2>&1 | tail -10
```
Expected: 9 tests PASS

**Step 5: Verify build**
```bash
npm run build 2>&1 | tail -3
```

**Step 6: Commit**
```bash
git add src/components/Workouts/hooks/
git commit -m "feat(AMA-867): implement useWorkoutList hook with tests"
```

---

### Task 3: Write WorkoutList.tsx thin shell

**Files:**
- Modify: `src/components/Workouts/WorkoutList.tsx`
- Read first: `src/components/UnifiedWorkouts.tsx` lines ~800-1647 (JSX rendering)
- Read first: `src/components/Workouts/hooks/useWorkoutList.ts` (what it returns)

**Rules (same as AMA-866):**
- 0 useState
- 0 useEffect
- 0 top-level handler definitions
- Props interface stays in this file (public API)
- Rename: exported function is `WorkoutList`, interface is `WorkoutListProps`

**Structure:**
```typescript
// src/components/Workouts/WorkoutList.tsx
import { useWorkoutList } from './hooks/useWorkoutList';
import { ViewWorkout } from '../ViewWorkout';
import { WorkoutEditSheet } from '../WorkoutEditor/WorkoutEditSheet';
// ... all JSX imports (shadcn, lucide, local components)
// Import paths are one level up: '../ui/button', '../../lib/...', etc.

export interface WorkoutListProps {
  profileId: string;
  onEditWorkout: (item: WorkoutHistoryItem) => void;
  onLoadWorkout: (item: WorkoutHistoryItem) => void;
  onDeleteWorkout: (id: string) => void;
  onBulkDeleteWorkouts?: (ids: string[]) => Promise<void> | void;
  onViewProgram?: (programId: string) => void;
}

export function WorkoutList(props: WorkoutListProps) {
  const { profileId, onEditWorkout, onLoadWorkout, onDeleteWorkout, onBulkDeleteWorkouts, onViewProgram } = props;

  const {
    // destructure all state + handlers from hook
  } = useWorkoutList(props);

  return (
    // JSX copied verbatim from UnifiedWorkouts.tsx
  );
}
```

**Import path adjustments** (new file at `src/components/Workouts/WorkoutList.tsx`):
- `../ui/button` (was `./ui/button`)
- `../ui/card` (was `./ui/card`)
- `../ViewWorkout` (was `./ViewWorkout`)
- `../WorkoutEditor/WorkoutEditSheet` (was `./WorkoutEditor/WorkoutEditSheet`)
- `../../lib/export-api` (was `../lib/export-api`)
- etc.

**Step 1: Write the thin shell** (copy JSX from old file)

**Step 2: Check line count**
```bash
wc -l src/components/Workouts/WorkoutList.tsx
```
Target ≤ 200. If exceeded, verify excess is pure JSX (cards, dialogs, dropdowns).

**Step 3: Verify 0 useState**
```bash
grep -c "useState" src/components/Workouts/WorkoutList.tsx
```
Expected: 0

**Step 4: Verify build**
```bash
npm run build 2>&1 | tail -3
```

**Step 5: Commit**
```bash
git add src/components/Workouts/WorkoutList.tsx
git commit -m "feat(AMA-867): write WorkoutList thin JSX shell"
```

---

### Task 4: Cut over router + WorkflowView, delete old file

**Files:**
- Modify: `src/app/router.tsx` — update lazy import path + rename export
- Modify: `src/app/WorkflowView.tsx` — update JSX tag name
- Delete: `src/components/UnifiedWorkouts.tsx`

**Step 1: Update router.tsx**

Find:
```typescript
export const UnifiedWorkouts = lazy(() =>
  import('../components/UnifiedWorkouts').then(m => ({ default: m.UnifiedWorkouts }))
);
```
Replace with:
```typescript
export const WorkoutList = lazy(() =>
  import('../components/Workouts/WorkoutList').then(m => ({ default: m.WorkoutList }))
);
```

Also update the `View` type if it references `UnifiedWorkouts` by name (check — it likely doesn't; the view string is `'workouts'` not the component name).

**Step 2: Update WorkflowView.tsx**

Two changes:
1. Update the import: `UnifiedWorkouts` → `WorkoutList` in the `from './router'` import block
2. Update the JSX tag: `<UnifiedWorkouts` → `<WorkoutList`

**Step 3: Check for any other files importing old path**
```bash
grep -rn "from.*components/UnifiedWorkouts" src/
grep -rn "UnifiedWorkouts" src/ | grep -v ".test." | grep -v "docs/"
```
Fix any remaining references.

**Step 4: Delete old flat file**
```bash
git rm src/components/UnifiedWorkouts.tsx
```

**Step 5: Verify build**
```bash
npm run build 2>&1 | tail -3
```
Expected: SUCCESS

**Step 6: Run tests**
```bash
npm test -- --reporter=verbose 2>&1 | grep -E "Tests:|Test Files:" | tail -5
```

**Step 7: Acceptance criteria check**
```bash
ls src/components/UnifiedWorkouts.tsx 2>&1      # should say "No such file"
grep -c "useState" src/components/Workouts/WorkoutList.tsx   # should be 0
wc -l src/components/Workouts/WorkoutList.tsx               # note count
npx vitest run src/components/Workouts/ --reporter=verbose 2>&1 | tail -10
```

**Step 8: Commit**
```bash
git add src/app/router.tsx src/app/WorkflowView.tsx
git rm src/components/UnifiedWorkouts.tsx
git commit -m "feat(AMA-867): rename to WorkoutList, update router, delete UnifiedWorkouts"
```

---

### Task 5: Final verification and PR

**Step 1: Run full acceptance criteria**
```bash
ls src/components/UnifiedWorkouts.tsx 2>&1
grep -c "useState" src/components/Workouts/WorkoutList.tsx
wc -l src/components/Workouts/WorkoutList.tsx
npx vitest run src/components/Workouts/ --reporter=verbose 2>&1 | tail -15
npm run build 2>&1 | tail -3
```

**Step 2: Run E2E tests**
```bash
# Ensure server running on port 3030 with demo mode
python e2e/test_workflow_refactor.py 2>&1 | tail -10
```
Expected: 24/24 pass

**Step 3: Create PR**
```bash
gh pr create \
  --title "feat(AMA-867): refactor UnifiedWorkouts into Workouts/WorkoutList feature directory" \
  --body "$(cat <<'EOF'
## Summary

- Extracts 27 useState + all handlers from UnifiedWorkouts.tsx into useWorkoutList.ts hook
- Renames component from UnifiedWorkouts to WorkoutList (old name was impl detail)
- Relocates into src/components/Workouts/ feature directory
- Deletes src/components/UnifiedWorkouts.tsx (was 1,647 lines)
- Updates router.tsx lazy import + WorkflowView.tsx JSX tag
- Follows same pattern as StructureWorkout (AMA-866) and Import

## Acceptance Criteria

- [x] Old flat file deleted
- [x] New component TSX has 0 useState
- [x] renderHook() tests cover key state transitions
- [x] npm run build passes
- [x] Existing test suite passes
- [x] App behaviour identical — pure refactor + rename, no UX changes

## Test Plan
- [ ] npm test passes
- [ ] npm run build passes
- [ ] E2E: python e2e/test_workflow_refactor.py (24 tests)

Closes AMA-867
EOF
)"
```

**Step 4: Monitor CI**
```bash
gh pr checks <PR_NUMBER> --watch 2>&1 | tail -10
```

---

## Files summary

### Created
| File | Purpose |
|------|---------|
| `src/components/Workouts/hooks/useWorkoutList.ts` | All state + handlers |
| `src/components/Workouts/hooks/__tests__/useWorkoutList.test.ts` | renderHook tests |
| `src/components/Workouts/WorkoutList.tsx` | Thin JSX shell |

### Modified
| File | Change |
|------|--------|
| `src/app/router.tsx` | `UnifiedWorkouts` → `WorkoutList`, new path |
| `src/app/WorkflowView.tsx` | `<UnifiedWorkouts` → `<WorkoutList` |

### Deleted
| File | Was |
|------|-----|
| `src/components/UnifiedWorkouts.tsx` | 1,647 lines, 27 useState |

---

## Acceptance criteria

- [ ] `src/components/UnifiedWorkouts.tsx` deleted
- [ ] `src/components/Workouts/WorkoutList.tsx` has 0 useState
- [ ] `npm run build` passes
- [ ] `npm test` passes (existing tests)
- [ ] E2E: 24/24 pass
- [ ] App behaviour identical — workouts view still works, edit/load/delete all functional
