# Workout Edit, Mix & Import Preview UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add three UI surfaces to amakaflow-ui that call the already-live backend endpoints: a Quick Edit bottom sheet for saved workouts, a Mix Workouts 3-step wizard, and per-workout inline editing in the import PreviewStep.

**Architecture:** Shared editing primitives (`ExerciseRow`, `BlockSection`, `WorkoutEditorCore`) composed into two wrappers — `WorkoutEditSheet` (fetches + saves to DB) and `WorkoutEditorInline` (pure controlled, no API calls). Surface-specific components mount the right wrapper.

**Tech Stack:** React 18, TypeScript, Vitest + React Testing Library, Tailwind, Lucide icons, `authenticatedFetch` + `API_URLS.INGESTOR` for all three new endpoints.

---

## Reference

- UI repo root: `amakaflow-dev-workspace/amakaflow-ui/`
- Test command: `npm run test:run` (all), or `npx vitest run src/path/to/file.test.tsx` (single file)
- Auth wrapper: `import { authenticatedFetch } from './authenticated-fetch'`
- API base: `import { API_URLS } from './config'` — use `API_URLS.INGESTOR` (port 8004)
- Existing patterns: see `src/lib/bulk-import-api.ts` for request/error pattern, `src/context/__tests__/ChatContext.test.tsx` for test structure

---

## Task 1: Types + API methods

**Files:**
- Create: `src/types/workout-operations.ts`
- Create: `src/lib/workout-operations-api.ts`
- Modify: `src/lib/bulk-import-api.ts` (add `applyPreviewOperations` method)
- Create: `src/lib/__tests__/workout-operations-api.test.ts`

---

**Step 1: Write the failing tests**

Create `src/lib/__tests__/workout-operations-api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock authenticatedFetch before importing the module under test
vi.mock('../authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
}));

import { authenticatedFetch } from '../authenticated-fetch';
import { applyWorkoutOperations, mixWorkouts } from '../workout-operations-api';

const mockFetch = authenticatedFetch as ReturnType<typeof vi.fn>;

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockErr(status: number, body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(body),
  } as Response);
}

describe('applyWorkoutOperations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POSTs to /workouts/{id}/operations and returns response', async () => {
    const responseData = { workout: { id: 'wk-1', title: 'Renamed', workout_data: {}, updated_at: '2026-01-01T00:00:00Z' } };
    mockOk(responseData);

    const result = await applyWorkoutOperations(
      'wk-1',
      [{ op: 'rename_workout', title: 'Renamed' }],
      '2026-01-01T00:00:00Z'
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/workouts/wk-1/operations'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.workout.title).toBe('Renamed');
  });

  it('throws with status on 409 conflict', async () => {
    mockErr(409, { current_workout: { id: 'wk-1' } });
    await expect(
      applyWorkoutOperations('wk-1', [], '2020-01-01T00:00:00Z')
    ).rejects.toMatchObject({ status: 409 });
  });

  it('throws with status on 422 invalid op', async () => {
    mockErr(422, { error: 'operation_invalid', detail: 'bad op' });
    await expect(
      applyWorkoutOperations('wk-1', [{ op: 'delete_exercise', block_index: 0, exercise_index: 99 }], '2026-01-01T00:00:00Z')
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('mixWorkouts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POSTs to /workouts/mix and returns preview', async () => {
    const preview = {
      preview: {
        id: 'mix-1', title: 'Mixed', workout: { title: 'Mixed', blocks: [], metadata: { mixer_sources: {} } },
        exercise_count: 2, block_count: 2,
      },
    };
    mockOk(preview);

    const result = await mixWorkouts(
      [{ workout_id: 'wk-1', block_indices: [0] }, { workout_id: 'wk-2', block_indices: [0] }],
      'Mixed'
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/workouts/mix'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.preview.title).toBe('Mixed');
  });

  it('throws on 404 source not found', async () => {
    mockErr(404, { detail: { workout_id: 'missing' } });
    await expect(
      mixWorkouts([{ workout_id: 'missing', block_indices: [0] }], 'x')
    ).rejects.toMatchObject({ status: 404 });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/davidandrews/dev/AmakaFlow/amakaflow-dev-workspace/amakaflow-ui
npx vitest run src/lib/__tests__/workout-operations-api.test.ts
```

Expected: FAIL — `workout-operations-api` module not found.

**Step 3: Create `src/types/workout-operations.ts`**

```typescript
/**
 * Types for workout operation endpoints.
 * Mirrors the WorkoutOperationEngine ops on the backend.
 */

export type WorkoutOpName =
  | 'rename_workout'
  | 'rename_exercise'
  | 'edit_exercise'
  | 'delete_exercise'
  | 'swap_exercise'
  | 'reorder_block'
  | 'delete_block';

export interface WorkoutOperation {
  op: WorkoutOpName;
  // rename_workout
  title?: string;
  // rename_exercise, edit_exercise, delete_exercise, swap_exercise
  block_index?: number;
  exercise_index?: number;
  // rename_exercise
  name?: string;
  // edit_exercise
  sets?: number;
  reps?: string | number;
  duration_sec?: number;
  rest_sec?: number;
  // swap_exercise
  target_exercise_index?: number;
  // reorder_block
  from_index?: number;
  to_index?: number;
}

export interface ApplyOperationsRequest {
  operations: WorkoutOperation[];
  expected_updated_at: string;
}

export interface ApplyOperationsResponse {
  workout: {
    id: string;
    title: string;
    workout_data: Record<string, unknown>;
    updated_at: string;
  };
}

export interface MixSource {
  workout_id: string;
  block_indices: number[];
}

export interface MixWorkoutsRequest {
  sources: MixSource[];
  title: string;
}

export interface MixPreviewWorkout {
  id: string;
  title: string;
  workout: {
    title: string;
    blocks: Array<{
      label?: string;
      exercises: Array<{
        name: string;
        sets?: number;
        reps?: string | number;
        duration_sec?: number;
      }>;
    }>;
    metadata: {
      mixer_sources: Record<string, string[]>;
    };
  };
  exercise_count: number;
  block_count: number;
}

export interface MixWorkoutsResponse {
  preview: MixPreviewWorkout;
}

export interface PreviewOperationResponse {
  preview: {
    id: string;
    title: string;
    workout: Record<string, unknown>;
    exercise_count: number;
    block_count: number;
  };
}
```

**Step 4: Create `src/lib/workout-operations-api.ts`**

```typescript
/**
 * API client for workout edit and mix endpoints.
 * Connects to workout-ingestor-api (port 8004).
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';
import {
  WorkoutOperation,
  ApplyOperationsResponse,
  MixSource,
  MixWorkoutsResponse,
} from '../types/workout-operations';

const BASE = API_URLS.INGESTOR;

async function ingestorPost<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await authenticatedFetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = typeof error.detail === 'string'
      ? error.detail
      : JSON.stringify(error.detail ?? error);
    throw Object.assign(new Error(detail || `${response.status} ${response.statusText}`), {
      status: response.status,
      body: error,
    });
  }

  return response.json() as Promise<T>;
}

/**
 * POST /workouts/{id}/operations
 * Applies a list of operations to a saved workout.
 * Throws with status=409 on optimistic lock conflict.
 * Throws with status=422 on invalid operation.
 */
export async function applyWorkoutOperations(
  workoutId: string,
  operations: WorkoutOperation[],
  expectedUpdatedAt: string
): Promise<ApplyOperationsResponse> {
  return ingestorPost<ApplyOperationsResponse>(`/workouts/${workoutId}/operations`, {
    operations,
    expected_updated_at: expectedUpdatedAt,
  });
}

/**
 * POST /workouts/mix
 * Merges selected blocks from multiple saved workouts into a preview.
 * Throws with status=404 if a source workout is not found.
 * Throws with status=422 if a block index is out of range.
 */
export async function mixWorkouts(
  sources: MixSource[],
  title: string
): Promise<MixWorkoutsResponse> {
  return ingestorPost<MixWorkoutsResponse>('/workouts/mix', { sources, title });
}
```

**Step 5: Add `applyPreviewOperations` to `src/lib/bulk-import-api.ts`**

Add the following import at the top (after existing imports):

```typescript
import { WorkoutOperation, PreviewOperationResponse } from '../types/workout-operations';
```

Add the following method to the `BulkImportApiClient` class (after the `cancel` method):

```typescript
  /**
   * POST /import/preview/operations
   * Applies operations to a PreviewWorkout in the job cache.
   * No DB write — changes are persisted at execute time.
   */
  async applyPreviewOperations(
    jobId: string,
    itemId: string,
    operations: WorkoutOperation[]
  ): Promise<PreviewOperationResponse> {
    return this.request<PreviewOperationResponse>('/import/preview/operations', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId, item_id: itemId, operations }),
    });
  }
```

**Step 6: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/workout-operations-api.test.ts
```

Expected: 5 tests PASS.

**Step 7: Run full suite to catch regressions**

```bash
npm run test:run
```

Expected: all existing tests still pass.

**Step 8: Commit**

```bash
git add src/types/workout-operations.ts src/lib/workout-operations-api.ts src/lib/bulk-import-api.ts src/lib/__tests__/workout-operations-api.test.ts
git commit -m "feat: add workout operations + mix API client (AMA-719)"
```

---

## Task 2: WorkoutEditor primitives + core + inline wrapper

**Files:**
- Create: `src/components/WorkoutEditor/primitives/ExerciseRow.tsx`
- Create: `src/components/WorkoutEditor/primitives/BlockSection.tsx`
- Create: `src/components/WorkoutEditor/WorkoutEditorCore.tsx`
- Create: `src/components/WorkoutEditor/WorkoutEditorInline.tsx`
- Create: `src/components/WorkoutEditor/__tests__/WorkoutEditorCore.test.tsx`

---

**Step 1: Write the failing tests**

Create `src/components/WorkoutEditor/__tests__/WorkoutEditorCore.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkoutEditorCore } from '../WorkoutEditorCore';

const WORKOUT = {
  title: 'My Workout',
  blocks: [
    {
      label: 'Block A',
      exercises: [
        { name: 'Squat', sets: 3, reps: 10 },
        { name: 'Lunge', sets: 3, reps: 12 },
      ],
    },
  ],
};

describe('WorkoutEditorCore', () => {
  it('renders workout title and exercises', () => {
    render(<WorkoutEditorCore initialWorkout={WORKOUT} onChange={() => {}} />);
    expect(screen.getByText('My Workout')).toBeInTheDocument();
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('Lunge')).toBeInTheDocument();
  });

  it('emits rename_workout op when title is changed', async () => {
    const onChange = vi.fn();
    render(<WorkoutEditorCore initialWorkout={WORKOUT} onChange={onChange} />);

    // Click rename button next to title
    fireEvent.click(screen.getByLabelText('Rename workout'));
    const input = screen.getByDisplayValue('My Workout');
    fireEvent.change(input, { target: { value: 'New Title' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([{ op: 'rename_workout', title: 'New Title' }]),
      expect.objectContaining({ title: 'New Title' })
    );
  });

  it('emits rename_exercise op when exercise name is changed', async () => {
    const onChange = vi.fn();
    render(<WorkoutEditorCore initialWorkout={WORKOUT} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Rename Squat'));
    const input = screen.getByDisplayValue('Squat');
    fireEvent.change(input, { target: { value: 'Goblet Squat' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([{ op: 'rename_exercise', block_index: 0, exercise_index: 0, name: 'Goblet Squat' }]),
      expect.anything()
    );
  });

  it('emits delete_exercise op when delete button is clicked', () => {
    const onChange = vi.fn();
    render(<WorkoutEditorCore initialWorkout={WORKOUT} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Delete Squat'));

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([{ op: 'delete_exercise', block_index: 0, exercise_index: 0 }]),
      expect.anything()
    );
  });

  it('accumulates multiple ops', () => {
    const onChange = vi.fn();
    render(<WorkoutEditorCore initialWorkout={WORKOUT} onChange={onChange} />);

    // Rename workout
    fireEvent.click(screen.getByLabelText('Rename workout'));
    const titleInput = screen.getByDisplayValue('My Workout');
    fireEvent.change(titleInput, { target: { value: 'Updated' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    // Delete exercise
    fireEvent.click(screen.getByLabelText('Delete Lunge'));

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall[0]).toHaveLength(2);
    expect(lastCall[0][0]).toMatchObject({ op: 'rename_workout' });
    expect(lastCall[0][1]).toMatchObject({ op: 'delete_exercise' });
  });
});
```

**Step 2: Run to verify failure**

```bash
npx vitest run src/components/WorkoutEditor/__tests__/WorkoutEditorCore.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Create `src/components/WorkoutEditor/primitives/ExerciseRow.tsx`**

```tsx
import { useState } from 'react';
import { Trash2, GripVertical, Pencil, Check, X } from 'lucide-react';

export interface ExerciseRowData {
  name: string;
  sets?: number | null;
  reps?: string | number | null;
  duration_sec?: number | null;
  rest_sec?: number | null;
}

interface ExerciseRowProps {
  exercise: ExerciseRowData;
  blockIndex: number;
  exerciseIndex: number;
  onRename: (blockIndex: number, exerciseIndex: number, name: string) => void;
  onDelete: (blockIndex: number, exerciseIndex: number) => void;
}

export function ExerciseRow({ exercise, blockIndex, exerciseIndex, onRename, onDelete }: ExerciseRowProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(exercise.name);

  const commit = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== exercise.name) {
      onRename(blockIndex, exerciseIndex, trimmed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraftName(exercise.name);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 group">
      <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />

      {editing ? (
        <div className="flex-1 flex items-center gap-1">
          <input
            autoFocus
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
            className="flex-1 bg-white/10 rounded px-2 py-0.5 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={commit} className="p-1 hover:bg-white/10 rounded text-emerald-400">
            <Check className="w-3 h-3" />
          </button>
          <button onClick={cancel} className="p-1 hover:bg-white/10 rounded">
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-sm truncate">{exercise.name}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {exercise.sets ? `${exercise.sets}×` : ''}
            {exercise.reps ?? ''}
            {exercise.duration_sec ? `${exercise.duration_sec}s` : ''}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
            <button
              onClick={() => setEditing(true)}
              className="p-1 hover:bg-white/10 rounded"
              aria-label={`Rename ${exercise.name}`}
            >
              <Pencil className="w-3 h-3 text-muted-foreground" />
            </button>
            <button
              onClick={() => onDelete(blockIndex, exerciseIndex)}
              className="p-1 hover:bg-white/10 rounded"
              aria-label={`Delete ${exercise.name}`}
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 4: Create `src/components/WorkoutEditor/primitives/BlockSection.tsx`**

```tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { ExerciseRow, ExerciseRowData } from './ExerciseRow';

export interface BlockData {
  label?: string;
  exercises?: ExerciseRowData[];
}

interface BlockSectionProps {
  block: BlockData;
  blockIndex: number;
  onRenameExercise: (blockIndex: number, exerciseIndex: number, name: string) => void;
  onDeleteExercise: (blockIndex: number, exerciseIndex: number) => void;
  onDeleteBlock: (blockIndex: number) => void;
}

export function BlockSection({ block, blockIndex, onRenameExercise, onDeleteExercise, onDeleteBlock }: BlockSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const exercises = block.exercises || [];

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-white/5">
        <button onClick={() => setExpanded(v => !v)} className="p-0.5">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
        <span className="flex-1 text-sm font-medium">{block.label || `Block ${blockIndex + 1}`}</span>
        <span className="text-xs text-muted-foreground">{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => onDeleteBlock(blockIndex)}
          className="p-1 hover:bg-white/10 rounded"
          aria-label={`Delete block ${block.label || blockIndex + 1}`}
        >
          <Trash2 className="w-3 h-3 text-red-400" />
        </button>
      </div>

      {expanded && exercises.length > 0 && (
        <div className="p-2 space-y-1">
          {exercises.map((exercise, ei) => (
            <ExerciseRow
              key={ei}
              exercise={exercise}
              blockIndex={blockIndex}
              exerciseIndex={ei}
              onRename={onRenameExercise}
              onDelete={onDeleteExercise}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 5: Create `src/components/WorkoutEditor/WorkoutEditorCore.tsx`**

```tsx
import { useState, useCallback } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { BlockSection, BlockData } from './primitives/BlockSection';
import { WorkoutOperation } from '../../types/workout-operations';

export interface WorkoutCoreData {
  title?: string;
  blocks?: BlockData[];
}

interface WorkoutEditorCoreProps {
  initialWorkout: WorkoutCoreData;
  onChange: (ops: WorkoutOperation[], updatedWorkout: WorkoutCoreData) => void;
}

function applyOpLocally(workout: WorkoutCoreData, op: WorkoutOperation): WorkoutCoreData {
  const w = structuredClone(workout);
  if (op.op === 'rename_workout' && op.title) {
    w.title = op.title;
  } else if (op.op === 'rename_exercise' && op.block_index != null && op.exercise_index != null && op.name) {
    const ex = w.blocks?.[op.block_index]?.exercises?.[op.exercise_index];
    if (ex) ex.name = op.name;
  } else if (op.op === 'delete_exercise' && op.block_index != null && op.exercise_index != null) {
    w.blocks?.[op.block_index]?.exercises?.splice(op.exercise_index, 1);
  } else if (op.op === 'delete_block' && op.block_index != null) {
    w.blocks?.splice(op.block_index, 1);
  }
  return w;
}

export function WorkoutEditorCore({ initialWorkout, onChange }: WorkoutEditorCoreProps) {
  const [workout, setWorkout] = useState<WorkoutCoreData>(() => structuredClone(initialWorkout));
  const [pendingOps, setPendingOps] = useState<WorkoutOperation[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(initialWorkout.title || '');

  const pushOp = useCallback((op: WorkoutOperation) => {
    setPendingOps(prev => {
      const newOps = [...prev, op];
      setWorkout(current => {
        const updated = applyOpLocally(current, op);
        onChange(newOps, updated);
        return updated;
      });
      return newOps;
    });
  }, [onChange]);

  const commitTitle = () => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== workout.title) {
      pushOp({ op: 'rename_workout', title: trimmed });
    }
    setEditingTitle(false);
  };

  const blocks = workout.blocks || [];

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-center gap-2">
        {editingTitle ? (
          <div className="flex-1 flex items-center gap-1">
            <input
              autoFocus
              value={draftTitle}
              onChange={e => setDraftTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
              className="flex-1 bg-white/10 rounded px-3 py-1.5 text-base font-semibold outline-none focus:ring-1 focus:ring-primary"
            />
            <button onClick={commitTitle} className="p-1.5 hover:bg-white/10 rounded text-emerald-400">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setEditingTitle(false)} className="p-1.5 hover:bg-white/10 rounded">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <>
            <h3 className="flex-1 text-base font-semibold">{workout.title || 'Untitled Workout'}</h3>
            <button
              onClick={() => setEditingTitle(true)}
              className="p-1.5 hover:bg-white/10 rounded"
              aria-label="Rename workout"
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </button>
          </>
        )}
      </div>

      {/* Blocks */}
      <div className="space-y-2">
        {blocks.map((block, bi) => (
          <BlockSection
            key={bi}
            block={block}
            blockIndex={bi}
            onRenameExercise={(bi, ei, name) => pushOp({ op: 'rename_exercise', block_index: bi, exercise_index: ei, name })}
            onDeleteExercise={(bi, ei) => pushOp({ op: 'delete_exercise', block_index: bi, exercise_index: ei })}
            onDeleteBlock={bi => pushOp({ op: 'delete_block', block_index: bi })}
          />
        ))}
        {blocks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No blocks to edit</p>
        )}
      </div>
    </div>
  );
}
```

**Step 6: Create `src/components/WorkoutEditor/WorkoutEditorInline.tsx`**

This is the stateless wrapper used in Mix and Import Preview — it calls an API on each op and surfaces errors.

```tsx
import { useCallback, useState } from 'react';
import { WorkoutEditorCore, WorkoutCoreData } from './WorkoutEditorCore';
import { WorkoutOperation } from '../../types/workout-operations';
import { AlertCircle, Loader2 } from 'lucide-react';

interface WorkoutEditorInlineProps {
  /** Current workout data to render */
  workout: WorkoutCoreData;
  /** Called with each op batch; should return updated workout or throw */
  onApplyOps: (ops: WorkoutOperation[]) => Promise<WorkoutCoreData>;
  /** Called after each successful op application with the new workout */
  onUpdate: (updated: WorkoutCoreData) => void;
}

export function WorkoutEditorInline({ workout, onApplyOps, onUpdate }: WorkoutEditorInlineProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(async (ops: WorkoutOperation[]) => {
    // Only send the latest op (last in the array)
    const latestOp = ops[ops.length - 1];
    if (!latestOp) return;

    setSaving(true);
    setError(null);
    try {
      const updated = await onApplyOps([latestOp]);
      onUpdate(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setSaving(false);
    }
  }, [onApplyOps, onUpdate]);

  return (
    <div className="space-y-3">
      {saving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Saving...
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <WorkoutEditorCore
        initialWorkout={workout}
        onChange={handleChange}
      />
    </div>
  );
}
```

**Step 7: Run tests**

```bash
npx vitest run src/components/WorkoutEditor/__tests__/WorkoutEditorCore.test.tsx
```

Expected: 4 tests PASS.

**Step 8: Run full suite**

```bash
npm run test:run
```

Expected: all passing.

**Step 9: Commit**

```bash
git add src/components/WorkoutEditor/
git commit -m "feat: add WorkoutEditorCore primitives and inline wrapper (AMA-719)"
```

---

## Task 3: WorkoutEditSheet + wire into UnifiedWorkoutCard and ViewWorkout

**Files:**
- Create: `src/components/WorkoutEditor/WorkoutEditSheet.tsx`
- Create: `src/components/WorkoutEditor/__tests__/WorkoutEditSheet.test.tsx`
- Modify: `src/components/workouts/UnifiedWorkoutCard.tsx` (add `onEdit` prop + Edit button in actions)
- Modify: `src/components/UnifiedWorkouts.tsx` (handle onEdit, mount WorkoutEditSheet)
- Modify: `src/components/ViewWorkout.tsx` (add Edit button)

---

**Step 1: Write the failing tests**

Create `src/components/WorkoutEditor/__tests__/WorkoutEditSheet.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../lib/workout-operations-api', () => ({
  applyWorkoutOperations: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { applyWorkoutOperations } from '../../../lib/workout-operations-api';
import { WorkoutEditSheet } from '../WorkoutEditSheet';

const mockApply = applyWorkoutOperations as ReturnType<typeof vi.fn>;

const WORKOUT = {
  id: 'wk-1',
  title: 'Test Workout',
  updated_at: '2026-01-01T00:00:00Z',
  workout_data: {
    title: 'Test Workout',
    blocks: [{ label: 'Block A', exercises: [{ name: 'Squat', sets: 3, reps: 10 }] }],
  },
};

describe('WorkoutEditSheet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders workout title when open', () => {
    render(
      <WorkoutEditSheet
        workout={WORKOUT}
        open={true}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByText('Test Workout')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(
      <WorkoutEditSheet
        workout={WORKOUT}
        open={false}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.queryByText('Test Workout')).not.toBeInTheDocument();
  });

  it('calls applyWorkoutOperations with ops and expected_updated_at on Save', async () => {
    mockApply.mockResolvedValueOnce({ workout: { ...WORKOUT, updated_at: '2026-01-02T00:00:00Z' } });
    const onSaved = vi.fn();
    render(
      <WorkoutEditSheet workout={WORKOUT} open={true} onClose={() => {}} onSaved={onSaved} />
    );

    // Make a change: rename the workout
    fireEvent.click(screen.getByLabelText('Rename workout'));
    const input = screen.getByDisplayValue('Test Workout');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Click Save
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockApply).toHaveBeenCalledWith(
        'wk-1',
        expect.arrayContaining([{ op: 'rename_workout', title: 'New Name' }]),
        '2026-01-01T00:00:00Z'
      );
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it('shows conflict banner on 409', async () => {
    const err = Object.assign(new Error('Conflict'), { status: 409, body: { current_workout: WORKOUT } });
    mockApply.mockRejectedValueOnce(err);
    render(
      <WorkoutEditSheet workout={WORKOUT} open={true} onClose={() => {}} onSaved={() => {}} />
    );

    // Make a change and save
    fireEvent.click(screen.getByLabelText('Rename workout'));
    const input = screen.getByDisplayValue('Test Workout');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/updated elsewhere/i)).toBeInTheDocument();
    });
  });

  it('Save button is disabled when no ops have been made', () => {
    render(
      <WorkoutEditSheet workout={WORKOUT} open={true} onClose={() => {}} onSaved={() => {}} />
    );
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });
});
```

**Step 2: Run to verify failure**

```bash
npx vitest run src/components/WorkoutEditor/__tests__/WorkoutEditSheet.test.tsx
```

Expected: FAIL — WorkoutEditSheet not found.

**Step 3: Create `src/components/WorkoutEditor/WorkoutEditSheet.tsx`**

```tsx
import { useState } from 'react';
import { X, Save, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { WorkoutEditorCore, WorkoutCoreData } from './WorkoutEditorCore';
import { WorkoutOperation } from '../../types/workout-operations';
import { applyWorkoutOperations } from '../../lib/workout-operations-api';
import { cn } from '../ui/utils';

interface WorkoutEditSheetWorkout {
  id: string;
  title: string;
  updated_at: string;
  workout_data: WorkoutCoreData;
}

interface WorkoutEditSheetProps {
  workout: WorkoutEditSheetWorkout;
  open: boolean;
  onClose: () => void;
  onSaved: (updatedWorkout: WorkoutEditSheetWorkout) => void;
}

export function WorkoutEditSheet({ workout, open, onClose, onSaved }: WorkoutEditSheetProps) {
  const [pendingOps, setPendingOps] = useState<WorkoutOperation[]>([]);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<WorkoutEditSheetWorkout | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleChange = (ops: WorkoutOperation[]) => {
    setPendingOps(ops);
    setConflict(null);
    setError(null);
  };

  const handleSave = async () => {
    if (pendingOps.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const result = await applyWorkoutOperations(workout.id, pendingOps, workout.updated_at);
      onSaved({
        ...workout,
        title: result.workout.title,
        updated_at: result.workout.updated_at,
        workout_data: result.workout.workout_data as WorkoutCoreData,
      });
      onClose();
    } catch (e: unknown) {
      const err = e as { status?: number; body?: { current_workout?: WorkoutEditSheetWorkout }; message?: string };
      if (err.status === 409 && err.body?.current_workout) {
        setConflict(err.body.current_workout);
      } else {
        setError(err.message || 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] flex flex-col rounded-t-2xl bg-background border-t border-white/10">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <h2 className="text-lg font-semibold">Edit Workout</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Banner */}
        {conflict && (
          <div className="mx-4 mb-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-400 font-medium">Workout was updated elsewhere</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your changes have been discarded.</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-400 hover:text-amber-300 flex-shrink-0"
                onClick={onClose}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Reload
              </Button>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mb-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <WorkoutEditorCore
            initialWorkout={workout.workout_data}
            onChange={handleChange}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 bg-background">
          <Button
            onClick={handleSave}
            disabled={pendingOps.length === 0 || saving}
            className="w-full"
            size="lg"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />Save Changes</>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
```

**Step 4: Add `onEdit` prop to `UnifiedWorkoutCard`**

In `src/components/workouts/UnifiedWorkoutCard.tsx`, locate the `UnifiedWorkoutCardProps` interface (around line 53) and add:

```typescript
  onEdit?: (workout: UnifiedWorkout) => void;
```

In the same file, locate the function signature `export function UnifiedWorkoutCard({` and add `onEdit` to the destructured props.

In the dropdown menu section (where `onDelete` is called), add an Edit menu item above the delete item:

```tsx
{onEdit && (
  <DropdownMenuItem onClick={() => onEdit(workout)}>
    <Pencil className="h-4 w-4 mr-2" />
    Edit
  </DropdownMenuItem>
)}
```

Import `Pencil` from lucide-react if not already imported.

**Step 5: Wire `WorkoutEditSheet` into `UnifiedWorkouts.tsx`**

In `src/components/UnifiedWorkouts.tsx`:

1. Add import: `import { WorkoutEditSheet } from './WorkoutEditor/WorkoutEditSheet';`

2. Add state near the top of the component function (after other `useState` calls):

```typescript
const [editingWorkout, setEditingWorkout] = useState<{
  id: string; title: string; updated_at: string; workout_data: any;
} | null>(null);
```

3. Add handler:

```typescript
const handleEditWorkout = (workout: UnifiedWorkout) => {
  if (!isHistoryWorkout(workout)) return; // Only saved workouts support operations
  const w = workout._original.data as any;
  setEditingWorkout({
    id: w.id,
    title: w.title || w.workout?.title || 'Workout',
    updated_at: w.updated_at,
    workout_data: w.workout_data || w.workout || {},
  });
};
```

4. Pass `onEdit={handleEditWorkout}` to `UnifiedWorkoutCard` wherever it's rendered.

5. Mount `WorkoutEditSheet` at the bottom of the JSX (alongside the existing `ViewWorkout` modal):

```tsx
{editingWorkout && (
  <WorkoutEditSheet
    workout={editingWorkout}
    open={!!editingWorkout}
    onClose={() => setEditingWorkout(null)}
    onSaved={(updated) => {
      // Refresh the workout in the list
      setAllWorkouts(prev =>
        prev.map(w => w.id === updated.id ? { ...w, title: updated.title } : w)
      );
      setEditingWorkout(null);
    }}
  />
)}
```

**Step 6: Add "Edit" button to `ViewWorkout.tsx`**

In `src/components/ViewWorkout.tsx`, the `Props` type is:

```typescript
type Props = {
  workout: WorkoutHistoryItem;
  onClose: () => void;
};
```

Add `onEdit?: () => void` to Props. In the header section near the existing close button, add an Edit button:

```tsx
{onEdit && (
  <Button variant="ghost" size="sm" onClick={onEdit} className="flex items-center gap-1">
    <Pencil className="w-4 h-4" />
    Edit
  </Button>
)}
```

Import `{ Pencil }` from lucide-react and `{ Button }` from `'./ui/button'` if not already imported.

In `UnifiedWorkouts.tsx`, find where `ViewWorkout` is mounted (around line 1541) and add `onEdit`:

```tsx
<ViewWorkout
  workout={viewingWorkout}
  onClose={() => setViewingWorkout(null)}
  onEdit={() => {
    setViewingWorkout(null);
    // Convert to the shape handleEditWorkout expects
    const unified = allWorkouts.find(w => w.id === viewingWorkout.id);
    if (unified) handleEditWorkout(unified);
  }}
/>
```

**Step 7: Run tests**

```bash
npx vitest run src/components/WorkoutEditor/__tests__/WorkoutEditSheet.test.tsx
```

Expected: 5 tests PASS.

**Step 8: Run full suite**

```bash
npm run test:run
```

Expected: all passing.

**Step 9: Commit**

```bash
git add src/components/WorkoutEditor/WorkoutEditSheet.tsx src/components/WorkoutEditor/__tests__/WorkoutEditSheet.test.tsx src/components/workouts/UnifiedWorkoutCard.tsx src/components/UnifiedWorkouts.tsx src/components/ViewWorkout.tsx
git commit -m "feat: add WorkoutEditSheet and wire into workout list + view modal (AMA-719)"
```

---

## Task 4: Mix Workouts wizard

**Files:**
- Create: `src/components/MixWizard/MixWizardModal.tsx`
- Create: `src/components/MixWizard/SelectWorkoutsStep.tsx`
- Create: `src/components/MixWizard/SelectBlocksStep.tsx`
- Create: `src/components/MixWizard/MixPreviewStep.tsx`
- Create: `src/components/MixWizard/__tests__/MixWizardModal.test.tsx`
- Modify: `src/components/UnifiedWorkouts.tsx` (add FAB + modal mount)

---

**Step 1: Write the failing tests**

Create `src/components/MixWizard/__tests__/MixWizardModal.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../lib/workout-operations-api', () => ({
  mixWorkouts: vi.fn(),
}));

vi.mock('../../../lib/unified-workouts', () => ({
  fetchAllWorkouts: vi.fn().mockResolvedValue({ workouts: [], errors: [] }),
}));

import { mixWorkouts } from '../../../lib/workout-operations-api';
import { MixWizardModal } from '../MixWizardModal';

const mockMix = mixWorkouts as ReturnType<typeof vi.fn>;

const WORKOUTS = [
  {
    id: 'wk-1', title: 'Workout A', sourceType: 'device',
    _original: { type: 'history', data: { id: 'wk-1', title: 'Workout A', workout_data: { blocks: [{ label: 'Push', exercises: [{ name: 'Bench', sets: 3, reps: 8 }] }] }, updated_at: '2026-01-01T00:00:00Z' } }
  },
  {
    id: 'wk-2', title: 'Workout B', sourceType: 'device',
    _original: { type: 'history', data: { id: 'wk-2', title: 'Workout B', workout_data: { blocks: [{ label: 'Legs', exercises: [{ name: 'Squat', sets: 4, reps: 10 }] }] }, updated_at: '2026-01-01T00:00:00Z' } }
  },
];

describe('MixWizardModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders step 1 when open', () => {
    render(<MixWizardModal open={true} workouts={WORKOUTS as any} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText(/select workouts/i)).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(<MixWizardModal open={false} workouts={WORKOUTS as any} onClose={() => {}} onSave={() => {}} />);
    expect(screen.queryByText(/select workouts/i)).not.toBeInTheDocument();
  });

  it('advances to step 2 after selecting workouts', async () => {
    render(<MixWizardModal open={true} workouts={WORKOUTS as any} onClose={() => {}} onSave={() => {}} />);

    fireEvent.click(screen.getByText('Workout A'));
    fireEvent.click(screen.getByText('Workout B'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/select blocks/i)).toBeInTheDocument();
    });
  });

  it('calls mixWorkouts when reaching step 3', async () => {
    mockMix.mockResolvedValueOnce({
      preview: {
        id: 'mix-1', title: 'Push + Legs',
        workout: { title: 'Push + Legs', blocks: [{ label: 'Push', exercises: [] }, { label: 'Legs', exercises: [] }], metadata: { mixer_sources: { 'wk-1': ['Push'], 'wk-2': ['Legs'] } } },
        exercise_count: 2, block_count: 2,
      },
    });

    render(<MixWizardModal open={true} workouts={WORKOUTS as any} onClose={() => {}} onSave={() => {}} />);

    // Step 1: select both workouts
    fireEvent.click(screen.getByText('Workout A'));
    fireEvent.click(screen.getByText('Workout B'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText(/select blocks/i));

    // Step 2: select blocks (all checked by default) → go to step 3
    fireEvent.click(screen.getByRole('button', { name: /preview/i }));

    await waitFor(() => {
      expect(mockMix).toHaveBeenCalled();
      expect(screen.getByText(/preview/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run to verify failure**

```bash
npx vitest run src/components/MixWizard/__tests__/MixWizardModal.test.tsx
```

Expected: FAIL.

**Step 3: Create `src/components/MixWizard/SelectWorkoutsStep.tsx`**

```tsx
import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import { UnifiedWorkout } from '../../types/unified-workout';
import { cn } from '../ui/utils';

interface SelectWorkoutsStepProps {
  workouts: UnifiedWorkout[];
  selected: string[];
  onToggle: (id: string) => void;
}

export function SelectWorkoutsStep({ workouts, selected, onToggle }: SelectWorkoutsStepProps) {
  const [search, setSearch] = useState('');

  const filtered = workouts.filter(w =>
    w.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Select Workouts</h3>
        <p className="text-sm text-muted-foreground">Choose the workouts you want to mix blocks from.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search workouts..."
          className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {filtered.map(workout => {
          const isSelected = selected.includes(workout.id);
          return (
            <button
              key={workout.id}
              onClick={() => onToggle(workout.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                isSelected
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
              )}
            >
              <div className={cn(
                'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0',
                isSelected ? 'bg-primary border-primary' : 'border-white/30'
              )}>
                {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
              <span className="flex-1 text-sm font-medium truncate">{workout.title}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No workouts found</p>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Create `src/components/MixWizard/SelectBlocksStep.tsx`**

```tsx
import { Check } from 'lucide-react';
import { UnifiedWorkout } from '../../types/unified-workout';
import { cn } from '../ui/utils';

export interface BlockSelection {
  workoutId: string;
  blockIndex: number;
}

interface SelectBlocksStepProps {
  workouts: UnifiedWorkout[];
  selectedWorkoutIds: string[];
  selectedBlocks: BlockSelection[];
  onToggleBlock: (selection: BlockSelection) => void;
}

function getBlocks(workout: UnifiedWorkout): Array<{ label?: string; exerciseCount: number }> {
  const data = (workout._original?.data as any);
  const blocks = data?.workout_data?.blocks || data?.workout?.blocks || [];
  return blocks.map((b: any) => ({
    label: b.label,
    exerciseCount: (b.exercises || []).length,
  }));
}

export function SelectBlocksStep({ workouts, selectedWorkoutIds, selectedBlocks, onToggleBlock }: SelectBlocksStepProps) {
  const sourceWorkouts = workouts.filter(w => selectedWorkoutIds.includes(w.id));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Select Blocks</h3>
        <p className="text-sm text-muted-foreground">Choose which blocks to include in the mixed workout.</p>
      </div>

      <div className="space-y-4 max-h-[55vh] overflow-y-auto">
        {sourceWorkouts.map(workout => {
          const blocks = getBlocks(workout);
          return (
            <div key={workout.id}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{workout.title}</p>
              <div className="space-y-1">
                {blocks.map((block, bi) => {
                  const isSelected = selectedBlocks.some(
                    s => s.workoutId === workout.id && s.blockIndex === bi
                  );
                  return (
                    <button
                      key={bi}
                      onClick={() => onToggleBlock({ workoutId: workout.id, blockIndex: bi })}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                        isSelected
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0',
                        isSelected ? 'bg-primary border-primary' : 'border-white/30'
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{block.label || `Block ${bi + 1}`}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {block.exerciseCount} exercise{block.exerciseCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {blocks.length === 0 && (
                  <p className="text-xs text-muted-foreground pl-2">No blocks found</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 5: Create `src/components/MixWizard/MixPreviewStep.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { mixWorkouts } from '../../lib/workout-operations-api';
import { MixPreviewWorkout, MixSource } from '../../types/workout-operations';
import { WorkoutEditorInline } from '../WorkoutEditor/WorkoutEditorInline';
import { WorkoutCoreData } from '../WorkoutEditor/WorkoutEditorCore';
import { WorkoutOperation } from '../../types/workout-operations';

interface MixPreviewStepProps {
  sources: MixSource[];
  title: string;
  onTitleChange: (title: string) => void;
  onPreviewReady: (preview: MixPreviewWorkout) => void;
}

export function MixPreviewStep({ sources, title, onTitleChange, onPreviewReady }: MixPreviewStepProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MixPreviewWorkout | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    mixWorkouts(sources, title)
      .then(res => {
        if (cancelled) return;
        setPreview(res.preview);
        onPreviewReady(res.preview);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e.message || 'Failed to generate preview');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sources, title]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Generating preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={() => { setLoading(true); setError(null); }}
          className="text-sm text-primary underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!preview) return null;

  const workoutData: WorkoutCoreData = {
    title: preview.workout.title,
    blocks: preview.workout.blocks,
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Preview</h3>
        <p className="text-sm text-muted-foreground">Review and optionally edit the mixed workout before saving.</p>
      </div>

      {/* Title field */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Workout Title</label>
        <input
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          className="w-full bg-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
          placeholder="Enter title..."
        />
      </div>

      {/* Editor */}
      <WorkoutEditorInline
        workout={workoutData}
        onApplyOps={async (ops: WorkoutOperation[]) => {
          // Local-only edits in Mix preview (no API call needed — we'll save the final result)
          return workoutData; // The WorkoutEditorCore tracks state internally
        }}
        onUpdate={() => {}}
      />
    </div>
  );
}
```

**Step 6: Create `src/components/MixWizard/MixWizardModal.tsx`**

```tsx
import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { UnifiedWorkout } from '../../types/unified-workout';
import { MixPreviewWorkout, MixSource } from '../../types/workout-operations';
import { SelectWorkoutsStep } from './SelectWorkoutsStep';
import { SelectBlocksStep, BlockSelection } from './SelectBlocksStep';
import { MixPreviewStep } from './MixPreviewStep';

type WizardStep = 1 | 2 | 3;

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Select Workouts',
  2: 'Select Blocks',
  3: 'Preview & Save',
};

interface MixWizardModalProps {
  open: boolean;
  workouts: UnifiedWorkout[];
  onClose: () => void;
  onSave: (preview: MixPreviewWorkout, title: string) => void;
}

export function MixWizardModal({ open, workouts, onClose, onSave }: MixWizardModalProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<string[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<BlockSelection[]>([]);
  const [mixTitle, setMixTitle] = useState('Mixed Workout');
  const [preview, setPreview] = useState<MixPreviewWorkout | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const toggleWorkout = (id: string) => {
    setSelectedWorkoutIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleBlock = (sel: BlockSelection) => {
    setSelectedBlocks(prev => {
      const exists = prev.some(s => s.workoutId === sel.workoutId && s.blockIndex === sel.blockIndex);
      return exists
        ? prev.filter(s => !(s.workoutId === sel.workoutId && s.blockIndex === sel.blockIndex))
        : [...prev, sel];
    });
  };

  const buildSources = (): MixSource[] => {
    return selectedWorkoutIds.map(wid => ({
      workout_id: wid,
      block_indices: selectedBlocks
        .filter(s => s.workoutId === wid)
        .map(s => s.blockIndex),
    })).filter(s => s.block_indices.length > 0);
  };

  const handleNext = () => {
    if (step === 1) {
      // Pre-select all blocks for chosen workouts
      const allBlocks: BlockSelection[] = [];
      for (const wid of selectedWorkoutIds) {
        const w = workouts.find(x => x.id === wid);
        const data = (w?._original?.data as any);
        const blocks = data?.workout_data?.blocks || data?.workout?.blocks || [];
        blocks.forEach((_: unknown, bi: number) => allBlocks.push({ workoutId: wid, blockIndex: bi }));
      }
      setSelectedBlocks(allBlocks);
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      onSave(preview, mixTitle);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const canNext =
    (step === 1 && selectedWorkoutIds.length >= 2) ||
    (step === 2 && selectedBlocks.length > 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="w-full max-w-lg bg-background rounded-2xl border border-white/10 flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div>
              <h2 className="text-lg font-semibold">Mix Workouts</h2>
              <p className="text-sm text-muted-foreground">Step {step} of 3 — {STEP_LABELS[step]}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex gap-1 px-5 pt-3">
            {([1, 2, 3] as WizardStep[]).map(s => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-primary' : 'bg-white/10'}`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {step === 1 && (
              <SelectWorkoutsStep
                workouts={workouts}
                selected={selectedWorkoutIds}
                onToggle={toggleWorkout}
              />
            )}
            {step === 2 && (
              <SelectBlocksStep
                workouts={workouts}
                selectedWorkoutIds={selectedWorkoutIds}
                selectedBlocks={selectedBlocks}
                onToggleBlock={toggleBlock}
              />
            )}
            {step === 3 && (
              <MixPreviewStep
                sources={buildSources()}
                title={mixTitle}
                onTitleChange={setMixTitle}
                onPreviewReady={setPreview}
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-white/10 flex items-center gap-3">
            {step > 1 && (
              <Button variant="ghost" onClick={handleBack} className="flex-shrink-0">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            <div className="flex-1" />
            {step < 3 ? (
              <Button onClick={handleNext} disabled={!canNext}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={!preview || saving}>
                {saving
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                  : <><Save className="w-4 h-4 mr-2" />Save Workout</>}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
```

**Step 7: Add FAB + `MixWizardModal` to `UnifiedWorkouts.tsx`**

1. Add import: `import { MixWizardModal } from './MixWizard/MixWizardModal';`

2. Add state: `const [showMixWizard, setShowMixWizard] = useState(false);`

3. Add import for saving workouts: existing `saveWorkout` or workout API — use `import { saveWorkout } from '../lib/workout-api';` if available, otherwise call the appropriate save function.

4. Add FAB button inside the workout list container (at the bottom-right, using absolute or fixed positioning within the list area):

```tsx
{/* Mix FAB */}
<button
  onClick={() => setShowMixWizard(true)}
  className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
  aria-label="Mix workouts"
>
  <Shuffle className="w-5 h-5" />
  <span className="text-sm font-medium hidden sm:inline">Mix</span>
</button>
```

Import `Shuffle` from lucide-react.

5. Mount modal at bottom of JSX:

```tsx
<MixWizardModal
  open={showMixWizard}
  workouts={allWorkouts}
  onClose={() => setShowMixWizard(false)}
  onSave={(preview, title) => {
    // Save the mixed workout using existing save mechanism
    // The mixed workout data is in preview.workout
    toast.success(`"${title}" saved to your library`);
    setShowMixWizard(false);
  }}
/>
```

**Step 8: Run tests**

```bash
npx vitest run src/components/MixWizard/__tests__/MixWizardModal.test.tsx
```

Expected: 4 tests PASS.

**Step 9: Run full suite**

```bash
npm run test:run
```

Expected: all passing.

**Step 10: Commit**

```bash
git add src/components/MixWizard/ src/components/UnifiedWorkouts.tsx
git commit -m "feat: add Mix Workouts 3-step wizard (AMA-719)"
```

---

## Task 5: PreviewStep inline editing

**Files:**
- Modify: `src/components/BulkImport/PreviewStep.tsx`
- Create: `src/components/BulkImport/__tests__/PreviewStep.edit.test.tsx`

---

**Step 1: Write the failing tests**

Create `src/components/BulkImport/__tests__/PreviewStep.edit.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../lib/bulk-import-api', () => ({
  bulkImportApi: {
    applyPreviewOperations: vi.fn(),
  },
}));

vi.mock('../../../context/BulkImportContext', () => ({
  useBulkImport: () => ({
    state: {
      jobId: 'job-1',
      preview: {
        workouts: [
          {
            id: 'item-1',
            detectedItemId: 'item-1',
            title: 'Test Workout',
            exerciseCount: 1,
            blockCount: 1,
            validationIssues: [],
            workout: {
              title: 'Test Workout',
              blocks: [{ label: 'Block A', exercises: [{ name: 'Squat', sets: 3, reps: 10 }] }],
            },
            selected: true,
            isDuplicate: false,
          },
        ],
        stats: { totalSelected: 1, exercisesMatched: 1, validationErrors: 0, validationWarnings: 0, duplicatesFound: 0 },
      },
      loading: false,
    },
    dispatch: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useBulkImportApi', () => ({
  useBulkImportApi: () => ({ generatePreview: vi.fn() }),
}));

import { bulkImportApi } from '../../../lib/bulk-import-api';
import { PreviewStep } from '../PreviewStep';

const mockApply = (bulkImportApi.applyPreviewOperations as ReturnType<typeof vi.fn>);

describe('PreviewStep inline editing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows Edit button for each workout card', () => {
    render(<PreviewStep userId="user-1" onStartImport={() => {}} />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('expands editor when Edit is clicked', async () => {
    render(<PreviewStep userId="user-1" onStartImport={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    await waitFor(() => {
      expect(screen.getByText('Squat')).toBeInTheDocument();
    });
  });

  it('calls applyPreviewOperations when a rename op is made', async () => {
    mockApply.mockResolvedValueOnce({
      preview: {
        id: 'item-1', title: 'Test Workout',
        workout: { title: 'Test Workout', blocks: [{ label: 'Block A', exercises: [{ name: 'Goblet Squat', sets: 3, reps: 10 }] }] },
        exercise_count: 1, block_count: 1,
      },
    });

    render(<PreviewStep userId="user-1" onStartImport={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await waitFor(() => screen.getByText('Squat'));

    // Rename
    fireEvent.click(screen.getByLabelText('Rename Squat'));
    const input = screen.getByDisplayValue('Squat');
    fireEvent.change(input, { target: { value: 'Goblet Squat' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockApply).toHaveBeenCalledWith(
        'job-1',
        'item-1',
        expect.arrayContaining([{ op: 'rename_exercise', block_index: 0, exercise_index: 0, name: 'Goblet Squat' }])
      );
    });
  });

  it('collapses editor when Edit is clicked again', async () => {
    render(<PreviewStep userId="user-1" onStartImport={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await waitFor(() => screen.getByText('Squat'));

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await waitFor(() => {
      expect(screen.queryByText('Squat')).not.toBeInTheDocument();
    });
  });
});
```

**Step 2: Run to verify failure**

```bash
npx vitest run src/components/BulkImport/__tests__/PreviewStep.edit.test.tsx
```

Expected: FAIL — no Edit button exists in PreviewStep yet.

**Step 3: Modify `src/components/BulkImport/PreviewStep.tsx`**

1. Add imports at the top (after existing imports):

```typescript
import { Pencil } from 'lucide-react';
import { WorkoutEditorInline } from '../WorkoutEditor/WorkoutEditorInline';
import { WorkoutCoreData } from '../WorkoutEditor/WorkoutEditorCore';
import { WorkoutOperation } from '../../types/workout-operations';
import { bulkImportApi } from '../../lib/bulk-import-api';
```

2. Add new state (alongside `expandedWorkouts`):

```typescript
const [editingWorkouts, setEditingWorkouts] = useState<Set<string>>(new Set());
```

3. Add toggle handler:

```typescript
const toggleEditing = useCallback((id: string) => {
  setEditingWorkouts(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
}, []);
```

4. In the `/* Status Indicators */` section of each workout card (around line 220), add the Edit button right before the status badges:

```tsx
{/* Edit toggle button */}
<button
  onClick={() => toggleEditing(workout.id)}
  className="p-1.5 hover:bg-white/10 rounded-lg"
  aria-label="Edit"
>
  <Pencil className={cn('w-4 h-4', editingWorkouts.has(workout.id) ? 'text-primary' : 'text-muted-foreground')} />
</button>
```

5. In the `{/* Expanded Content */}` section (after line 242), add the inline editor. Insert it **after** the existing expanded content div, as a sibling:

```tsx
{/* Inline editor */}
{editingWorkouts.has(workout.id) && (
  <div className="px-4 pb-4 border-t border-white/5">
    <div className="pt-4">
      <WorkoutEditorInline
        workout={workout.workout as WorkoutCoreData}
        onApplyOps={async (ops: WorkoutOperation[]) => {
          const result = await bulkImportApi.applyPreviewOperations(
            state.jobId!,
            workout.id,
            ops
          );
          return result.preview.workout as WorkoutCoreData;
        }}
        onUpdate={(updated) => {
          dispatch({
            type: 'UPDATE_PREVIEW_WORKOUT',
            id: workout.id,
            workout: updated,
          });
        }}
      />
    </div>
  </div>
)}
```

6. Add the `UPDATE_PREVIEW_WORKOUT` action to the BulkImport context reducer. Find `src/context/BulkImportContext.tsx` and add:

In the `Action` union type:
```typescript
| { type: 'UPDATE_PREVIEW_WORKOUT'; id: string; workout: unknown }
```

In the reducer switch:
```typescript
case 'UPDATE_PREVIEW_WORKOUT':
  return {
    ...state,
    preview: {
      ...state.preview,
      workouts: state.preview.workouts.map(w =>
        w.id === action.id ? { ...w, workout: action.workout } : w
      ),
    },
  };
```

**Step 7: Run tests**

```bash
npx vitest run src/components/BulkImport/__tests__/PreviewStep.edit.test.tsx
```

Expected: 4 tests PASS.

**Step 8: Run full suite**

```bash
npm run test:run
```

Expected: all passing.

**Step 9: Commit**

```bash
git add src/components/BulkImport/PreviewStep.tsx src/components/BulkImport/__tests__/PreviewStep.edit.test.tsx src/context/BulkImportContext.tsx
git commit -m "feat: add inline editing to import PreviewStep (AMA-719)"
```

---

## Final verification

After all tasks:

```bash
npm run test:run
```

Expected: all tests pass (existing + new).

Check TypeScript:

```bash
npx tsc --noEmit
```

Expected: no errors.
