import { useState, useCallback, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { BlockSection, BlockData } from './primitives/BlockSection';
import { ExerciseRowData } from './primitives/ExerciseRow';
import { WorkoutOperation } from '../../types/workout-operations';

export interface WorkoutCoreData {
  title?: string;
  blocks?: BlockData[];
}

// Internal types that carry stable UIDs for React keys
interface InternalExerciseData extends ExerciseRowData { _uid: number; }
interface InternalBlockData extends BlockData { exercises: InternalExerciseData[]; _uid: number; }
interface InternalWorkoutData extends WorkoutCoreData { blocks?: InternalBlockData[]; }

let _uidCounter = 0;
function nextUid() { return ++_uidCounter; }

interface WorkoutEditorCoreProps {
  initialWorkout: WorkoutCoreData;
  onChange: (ops: WorkoutOperation[], updatedWorkout: WorkoutCoreData) => void;
}

function applyOpLocally(workout: InternalWorkoutData, op: WorkoutOperation): InternalWorkoutData {
  const w = structuredClone(workout) as InternalWorkoutData;
  if (op.op === 'rename_workout') {
    w.title = op.title;
  } else if (op.op === 'rename_exercise') {
    const ex = w.blocks?.[op.block_index]?.exercises?.[op.exercise_index];
    if (ex) ex.name = op.name;
  } else if (op.op === 'edit_exercise') {
    const ex = w.blocks?.[op.block_index]?.exercises?.[op.exercise_index];
    if (ex) {
      if (op.sets !== undefined) ex.sets = op.sets;
      if (op.reps !== undefined) ex.reps = op.reps;
      if (op.duration_sec !== undefined) ex.duration_sec = op.duration_sec;
      if (op.rest_sec !== undefined) ex.rest_sec = op.rest_sec;
    }
  } else if (op.op === 'delete_exercise') {
    w.blocks?.[op.block_index]?.exercises?.splice(op.exercise_index, 1);
  } else if (op.op === 'swap_exercise') {
    const exercises = w.blocks?.[op.block_index]?.exercises;
    if (exercises) {
      const a = exercises[op.exercise_index];
      const b = exercises[op.target_exercise_index];
      if (a !== undefined && b !== undefined) {
        exercises[op.exercise_index] = b;
        exercises[op.target_exercise_index] = a;
      }
    }
  } else if (op.op === 'reorder_block') {
    if (w.blocks) {
      const [moved] = w.blocks.splice(op.from_index, 1);
      w.blocks.splice(op.to_index, 0, moved);
    }
  } else if (op.op === 'delete_block') {
    w.blocks?.splice(op.block_index, 1);
  }
  return w;
}

export function WorkoutEditorCore({ initialWorkout, onChange }: WorkoutEditorCoreProps) {
  const [workout, setWorkout] = useState<InternalWorkoutData>(() => {
    const cloned = structuredClone(initialWorkout) as InternalWorkoutData;
    cloned.blocks?.forEach(block => {
      (block as InternalBlockData)._uid = nextUid();
      block.exercises = (block.exercises || []).map(ex => ({
        ...ex,
        _uid: nextUid(),
      }));
    });
    return cloned;
  });
  const [pendingOps, setPendingOps] = useState<WorkoutOperation[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(initialWorkout.title || '');

  const pushOp = useCallback((op: WorkoutOperation) => {
    setWorkout(current => applyOpLocally(current, op));
    setPendingOps(prev => [...prev, op]);
  }, []);

  // Call onChange AFTER state settles, not inside updaters
  useEffect(() => {
    if (pendingOps.length > 0) {
      onChange(pendingOps, workout);
    }
    // Note: intentionally only re-runs when pendingOps changes (not workout)
    // workout is captured at the time pendingOps updates, which is correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOps]);

  const commitTitle = useCallback(() => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== workout.title) {
      pushOp({ op: 'rename_workout', title: trimmed });
    }
    setEditingTitle(false);
  }, [draftTitle, workout, pushOp]);

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
            key={block._uid}
            block={block}
            blockIndex={bi}
            onRenameExercise={(blockIdx, exIdx, name) => pushOp({ op: 'rename_exercise', block_index: blockIdx, exercise_index: exIdx, name })}
            onDeleteExercise={(blockIdx, exIdx) => pushOp({ op: 'delete_exercise', block_index: blockIdx, exercise_index: exIdx })}
            onDeleteBlock={(blockIdx) => pushOp({ op: 'delete_block', block_index: blockIdx })}
          />
        ))}
        {blocks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No blocks to edit</p>
        )}
      </div>
    </div>
  );
}
