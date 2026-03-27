import { useState, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Grip, Edit2, Check, X, Trash2, Info, Timer, Hash, Repeat, ArrowLeftRight } from 'lucide-react';
import { Exercise } from '../types/workout';
import { Badge } from './ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { formatDuration, formatDistance } from '../lib/formatExercise';

interface DraggableExerciseProps {
  exercise: Exercise;
  index: number;
  blockIdx: number;
  supersetIdx: number;
  isEditing: boolean;
  editValues: Exercise;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  onEditChange: (values: Exercise) => void;
}

interface DragItem {
  type: string;
  index: number;
  blockIdx: number;
  supersetIdx: number;
}

export function DraggableExercise({
  exercise,
  index,
  blockIdx,
  supersetIdx,
  isEditing,
  editValues,
  onEdit,
  onSave,
  onCancel,
  onRemove,
  onMove,
  onEditChange
}: DraggableExerciseProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: 'exercise',
    item: { type: 'exercise', index, blockIdx, supersetIdx },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: 'exercise',
    hover(item: DragItem) {
      if (!ref.current) return;
      
      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex && item.blockIdx === blockIdx && item.supersetIdx === supersetIdx) {
        return;
      }

      // Only allow reordering within the same superset
      if (item.blockIdx !== blockIdx || item.supersetIdx !== supersetIdx) {
        return;
      }

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    })
  });

  // Combine drag and drop refs
  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`flex items-center gap-3 p-3 rounded-lg border bg-background transition-all ${
        isDragging ? 'opacity-50' : ''
      } ${isOver ? 'border-primary' : ''}`}
    >
      <div ref={preview}>
        <Grip className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
      </div>
      
      {isEditing ? (
        <div className="flex-1 space-y-3">
          <div>
            <Label className="text-xs">Exercise Name</Label>
            <Input
              value={editValues.name}
              onChange={(e) => onEditChange({ ...editValues, name: e.target.value })}
              className="h-8"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Hash className="w-3 h-3" /> Reps
              </Label>
              <Input
                type="number"
                value={editValues.reps || ''}
                onChange={(e) => onEditChange({ ...editValues, reps: parseInt(e.target.value) || undefined })}
                className="h-8"
                placeholder="-"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Timer className="w-3 h-3" /> Time (sec)
              </Label>
              <Input
                type="number"
                value={editValues.duration_sec || ''}
                onChange={(e) => onEditChange({ ...editValues, duration_sec: parseInt(e.target.value) || undefined })}
                className="h-8"
                placeholder="-"
              />
            </div>
            <div>
              <Label className="text-xs">Distance (m)</Label>
              <Input
                type="number"
                value={editValues.distance_m || ''}
                onChange={(e) => onEditChange({ ...editValues, distance_m: parseInt(e.target.value) || undefined })}
                className="h-8"
                placeholder="-"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Weight (kg)</Label>
              <Input
                type="number"
                value={editValues.weight_kg || ''}
                onChange={(e) => onEditChange({ ...editValues, weight_kg: parseInt(e.target.value) || undefined })}
                className="h-8"
                placeholder="-"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Repeat className="w-3 h-3" /> Sets
              </Label>
              <Input
                type="number"
                value={editValues.sets || ''}
                onChange={(e) => onEditChange({ ...editValues, sets: parseInt(e.target.value) || undefined })}
                className="h-8"
                placeholder="1"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1">{exercise.name}</div>
            {exercise.notes && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{exercise.notes}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Current values */}
            <div className="flex gap-2 text-sm">
              {exercise.reps && <Badge variant="secondary">{exercise.reps} reps</Badge>}
              {exercise.distance_m && <Badge variant="secondary">{formatDistance(exercise.distance_m)}</Badge>}
              {exercise.duration_sec && !exercise.sets && <Badge variant="secondary">{formatDuration(exercise.duration_sec)}</Badge>}
              {exercise.weight_kg && <Badge variant="secondary">{exercise.weight_kg}kg</Badge>}
              {/* AMA-729: Combined display - sets × duration per set (e.g., 3 × 30s) */}
              {exercise.sets && exercise.sets > 0 && exercise.duration_sec && exercise.duration_sec > 0 && (
                <Badge variant="default" className="bg-primary/20 text-primary">
                  <Repeat className="w-3 h-3 mr-1" />
                  {exercise.sets} × {formatDuration(exercise.duration_sec)}
                </Badge>
              )}
              {/* Regular sets badge (when no duration per set) */}
              {exercise.sets && exercise.sets > 1 && (!exercise.duration_sec || exercise.duration_sec === 0) && (
                <Badge variant="default" className="bg-primary/20 text-primary">
                  <Repeat className="w-3 h-3 mr-1" />
                  {exercise.sets} sets
                </Badge>
              )}
              {/* AMA-729: Time cap badge */}
              {exercise.time_cap_sec && exercise.time_cap_sec > 0 && (
                <Badge variant="outline" className="border-blue-500 text-blue-500">
                  <Timer className="w-3 h-3 mr-1" />
                  {formatDuration(exercise.time_cap_sec)} cap
                </Badge>
              )}
            </div>
            
            {/* Original values if different */}
            {exercise.original && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs">
                      Original
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <p className="font-medium">Original parsed values:</p>
                      {exercise.original.reps && <p>Reps: {exercise.original.reps}</p>}
                      {exercise.original.duration_sec && <p>Time: {exercise.original.duration_sec}s</p>}
                      {exercise.original.distance_m && <p>Distance: {exercise.original.distance_m}m</p>}
                      {exercise.original.weight_kg && <p>Weight: {exercise.original.weight_kg}kg</p>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Notes display (visible but not editable) */}
          {exercise.notes && (
            <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
              Note: {exercise.notes}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-1">
        {isEditing ? (
          <>
            <Button size="sm" variant="ghost" onClick={onSave}>
              <Check className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onRemove}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}