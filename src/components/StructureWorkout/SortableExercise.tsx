import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit2, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Exercise } from '../../types/workout';

// ── @dnd-kit drag data shapes ─────────────────────────────────────────────────
type DraggableData =
  | { type: 'block'; blockIdx: number }
  | { type: 'exercise'; blockIdx: number; exerciseIdx: number; supersetIdx: null }
  | { type: 'superset-exercise'; blockIdx: number; supersetIdx: number; exerciseIdx: number };

// ── Sortable Exercise ─────────────────────────────────────────────────────────
export function SortableExercise({
  exercise,
  blockIdx,
  exerciseIdx,
  supersetIdx,
  onEdit,
  onDelete,
  effectiveRestType,
  effectiveRestSec,
  isInSuperset = false,
}: {
  exercise: Exercise;
  blockIdx: number;
  exerciseIdx: number;
  supersetIdx?: number;
  onEdit: () => void;
  onDelete: () => void;
  effectiveRestType?: string;
  effectiveRestSec?: number;
  isInSuperset?: boolean;
}) {
  const draggableData: DraggableData = supersetIdx !== undefined
    ? { type: 'superset-exercise', blockIdx, supersetIdx, exerciseIdx }
    : { type: 'exercise', blockIdx, exerciseIdx, supersetIdx: null };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id, data: draggableData });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const getDisplayName = () => {
    return exercise.name || '';
  };

  const getDisplayText = () => {
    const parts: string[] = [];
    if (exercise.warmup_sets && exercise.warmup_sets > 0 && exercise.warmup_reps && exercise.warmup_reps > 0) {
      parts.push(`🔥 ${exercise.warmup_sets}×${exercise.warmup_reps} warmup`);
    }
    if (exercise.sets) parts.push(`${exercise.sets} sets`);
    if (exercise.reps) parts.push(`${exercise.reps} reps`);
    if (exercise.reps_range) parts.push(`${exercise.reps_range} reps`);
    if (exercise.duration_sec) {
      const minutes = Math.floor(exercise.duration_sec / 60);
      const seconds = exercise.duration_sec % 60;
      if (minutes > 0) {
        parts.push(seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`);
      } else {
        parts.push(`${seconds}s`);
      }
    }
    if (exercise.calories) parts.push(`${exercise.calories} cal`);
    if (exercise.distance_m) parts.push(`${exercise.distance_m}m`);
    if (exercise.distance_range) parts.push(`${exercise.distance_range}`);
    if (exercise.time_cap_sec && exercise.time_cap_sec > 0) {
      const mins = Math.floor(exercise.time_cap_sec / 60);
      const secs = exercise.time_cap_sec % 60;
      parts.push(secs > 0 ? `⏱ ${mins}m ${secs}s cap` : `⏱ ${mins}m cap`);
    }
    return parts.length > 0 ? parts.join(' • ') : null;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50 hover:bg-muted"
    >
      {/* Drag handle — only this element initiates drag */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="flex-1">
        <p className="font-medium">{getDisplayName()}</p>
        {getDisplayText() && (
          <p className="text-sm text-muted-foreground">
            {getDisplayText()}
          </p>
        )}
      </div>

      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
