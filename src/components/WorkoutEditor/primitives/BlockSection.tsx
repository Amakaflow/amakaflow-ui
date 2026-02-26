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
        <button
          onClick={() => setExpanded(v => !v)}
          className="p-0.5"
          aria-label={expanded ? 'Collapse block' : 'Expand block'}
        >
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
              key={(exercise as ExerciseRowData & { _uid?: number })._uid ?? ei}
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
