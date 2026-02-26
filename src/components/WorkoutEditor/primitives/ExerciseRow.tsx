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
