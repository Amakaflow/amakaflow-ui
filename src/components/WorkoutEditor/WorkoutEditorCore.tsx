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
  if (op.op === 'rename_workout') {
    w.title = op.title;
  } else if (op.op === 'rename_exercise') {
    const ex = w.blocks?.[op.block_index]?.exercises?.[op.exercise_index];
    if (ex) ex.name = op.name;
  } else if (op.op === 'delete_exercise') {
    w.blocks?.[op.block_index]?.exercises?.splice(op.exercise_index, 1);
  } else if (op.op === 'delete_block') {
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
