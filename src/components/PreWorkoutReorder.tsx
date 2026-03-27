/**
 * AMA-211: Pre-workout exercise reorder component.
 *
 * Before starting a workout, allows the user to drag-and-drop exercises
 * to customize the order. Uses the existing drag-and-drop infrastructure.
 */

import { useState, useCallback } from 'react';
import { GripVertical, RotateCcw, Check, X, MoveVertical } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import type { Block, Exercise, WorkoutStructure } from '../types/workout';
import {
  type PreWorkoutCustomization,
  type ReorderEvent,
  createPreWorkoutCustomization,
  applyReorder,
  flattenToDraggableItems,
} from '../types/workout-playback';

interface PreWorkoutReorderProps {
  workout: WorkoutStructure;
  onConfirm: (customizedBlocks: Block[]) => void;
  onCancel: () => void;
}

export function PreWorkoutReorder({ workout, onConfirm, onCancel }: PreWorkoutReorderProps) {
  const [customization, setCustomization] = useState<PreWorkoutCustomization>(
    createPreWorkoutCustomization(workout.blocks)
  );
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const items = flattenToDraggableItems(customization.blocks);

  const handleDragStart = useCallback((exerciseId: string) => {
    setDraggedItemId(exerciseId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItemId(null);
  }, []);

  const handleDrop = useCallback((targetId: string) => {
    if (!draggedItemId || draggedItemId === targetId) return;

    const sourceItem = items.find(i => i.id === draggedItemId);
    const targetItem = items.find(i => i.id === targetId);
    if (!sourceItem || !targetItem) return;

    const event: ReorderEvent = {
      exerciseId: draggedItemId,
      fromBlockIndex: sourceItem.blockIndex,
      fromExerciseIndex: sourceItem.exerciseIndex,
      toBlockIndex: targetItem.blockIndex,
      toExerciseIndex: targetItem.exerciseIndex,
    };

    const newBlocks = applyReorder(customization.blocks, event);
    setCustomization(prev => ({
      blocks: newBlocks,
      hasChanges: true,
      history: [...prev.history, event],
    }));
    setDraggedItemId(null);
  }, [draggedItemId, items, customization.blocks]);

  const handleMoveUp = useCallback((blockIndex: number, exerciseIndex: number) => {
    if (exerciseIndex === 0) return;
    const event: ReorderEvent = {
      exerciseId: customization.blocks[blockIndex].exercises[exerciseIndex].id,
      fromBlockIndex: blockIndex,
      fromExerciseIndex: exerciseIndex,
      toBlockIndex: blockIndex,
      toExerciseIndex: exerciseIndex - 1,
    };
    const newBlocks = applyReorder(customization.blocks, event);
    setCustomization(prev => ({
      blocks: newBlocks,
      hasChanges: true,
      history: [...prev.history, event],
    }));
  }, [customization.blocks]);

  const handleMoveDown = useCallback((blockIndex: number, exerciseIndex: number) => {
    const block = customization.blocks[blockIndex];
    if (exerciseIndex >= block.exercises.length - 1) return;
    const event: ReorderEvent = {
      exerciseId: block.exercises[exerciseIndex].id,
      fromBlockIndex: blockIndex,
      fromExerciseIndex: exerciseIndex,
      toBlockIndex: blockIndex,
      toExerciseIndex: exerciseIndex + 1,
    };
    const newBlocks = applyReorder(customization.blocks, event);
    setCustomization(prev => ({
      blocks: newBlocks,
      hasChanges: true,
      history: [...prev.history, event],
    }));
  }, [customization.blocks]);

  const handleReset = useCallback(() => {
    setCustomization(createPreWorkoutCustomization(workout.blocks));
  }, [workout.blocks]);

  const handleConfirm = useCallback(() => {
    onConfirm(customization.blocks);
  }, [customization.blocks, onConfirm]);

  return (
    <div className="space-y-4" data-testid="pre-workout-reorder">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{workout.title}</h2>
          <p className="text-sm text-muted-foreground">
            Drag exercises to customize the order before starting
          </p>
        </div>
        <div className="flex gap-2">
          {customization.hasChanges && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Blocks with exercises */}
      <div className="space-y-4">
        {customization.blocks.map((block, blockIndex) => (
          <div key={block.id ?? blockIndex} className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-3 py-2 flex items-center justify-between">
              <span className="font-medium text-sm">{block.label}</span>
              {block.structure && (
                <Badge variant="secondary" className="text-xs">
                  {block.structure}
                </Badge>
              )}
            </div>
            <ul className="divide-y" data-testid={`reorder-block-${blockIndex}`}>
              {block.exercises.map((exercise, exerciseIndex) => {
                const isDragging = draggedItemId === exercise.id;
                return (
                  <li
                    key={exercise.id}
                    data-testid={`reorder-exercise-${exercise.id}`}
                    draggable
                    onDragStart={() => handleDragStart(exercise.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(exercise.id)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 transition-colors cursor-grab active:cursor-grabbing',
                      isDragging ? 'opacity-50 bg-primary/5' : 'hover:bg-muted/50'
                    )}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{exercise.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {exercise.sets && `${exercise.sets} sets`}
                        {exercise.sets && exercise.reps && ' x '}
                        {exercise.reps && `${exercise.reps} reps`}
                        {exercise.duration_sec && `${exercise.duration_sec}s`}
                      </p>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleMoveUp(blockIndex, exerciseIndex)}
                        disabled={exerciseIndex === 0}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <MoveVertical className="w-3.5 h-3.5 rotate-180" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(blockIndex, exerciseIndex)}
                        disabled={exerciseIndex >= block.exercises.length - 1}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <MoveVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" />
          Cancel
        </Button>
        <Button onClick={handleConfirm} data-testid="reorder-confirm-btn">
          <Check className="w-4 h-4 mr-1" />
          {customization.hasChanges ? 'Start with Custom Order' : 'Start Workout'}
        </Button>
      </div>
    </div>
  );
}
