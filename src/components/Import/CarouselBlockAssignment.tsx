import { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { GripVertical, Dumbbell, Trash2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CarouselSlide, CarouselExercise } from './fixtures/carousel-demo';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SlideAssignment {
  slideIndex: number;
  blockLabel: string;
  exercises: CarouselExercise[];
  caption?: string;
}

export interface MergedWorkoutPreview {
  title: string;
  blocks: SlideAssignment[];
  totalExercises: number;
}

export interface CarouselBlockAssignmentProps {
  /** The slides the user selected in CarouselSlideSelector. */
  selectedSlides: CarouselSlide[];
  /** Post caption or default title for the merged workout. */
  workoutTitle?: string;
  /** Called with the final merged workout when the user confirms. */
  onConfirm: (merged: MergedWorkoutPreview) => void;
  onBack?: () => void;
}

// ── Sortable slide row ───────────────────────────────────────────────────────

function SortableSlideRow({
  assignment,
  onRemove,
  onLabelChange,
}: {
  assignment: SlideAssignment;
  onRemove: () => void;
  onLabelChange: (label: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `slide-${assignment.slideIndex}` });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group', isDragging && 'opacity-50 shadow-lg')}
      data-testid={`assignment-row-${assignment.slideIndex}`}
    >
      <Card>
        <CardContent className="p-3 flex items-start gap-3">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground hover:text-foreground shrink-0 mt-1"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={assignment.blockLabel}
                onChange={(e) => onLabelChange(e.target.value)}
                className="text-sm font-medium bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none flex-1 min-w-0"
                aria-label={`Block label for slide ${assignment.slideIndex + 1}`}
              />
              <Badge variant="secondary" className="text-xs shrink-0">
                <Dumbbell className="w-3 h-3 mr-1" />
                {assignment.exercises.length}
              </Badge>
            </div>

            {/* Exercise list */}
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {assignment.exercises.map((ex) => (
                <li key={ex.name} className="truncate">
                  {ex.name}
                  {ex.sets && ex.reps ? ` — ${ex.sets}x${ex.reps}` : ''}
                  {ex.sets && ex.duration_sec ? ` — ${ex.sets}x${ex.duration_sec}s` : ''}
                </li>
              ))}
            </ul>
          </div>

          {/* Remove */}
          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={`Remove slide ${assignment.slideIndex + 1}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function CarouselBlockAssignment({
  selectedSlides,
  workoutTitle = 'Merged Carousel Workout',
  onConfirm,
  onBack,
}: CarouselBlockAssignmentProps) {
  const [assignments, setAssignments] = useState<SlideAssignment[]>(() =>
    selectedSlides.map((slide) => ({
      slideIndex: slide.slideIndex,
      blockLabel: slide.caption ?? `Block ${slide.slideIndex + 1}`,
      exercises: [...slide.exercises],
      caption: slide.caption,
    })),
  );

  const totalExercises = useMemo(
    () => assignments.reduce((sum, a) => sum + a.exercises.length, 0),
    [assignments],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setAssignments((prev) => {
      const oldIndex = prev.findIndex((a) => `slide-${a.slideIndex}` === active.id);
      const newIndex = prev.findIndex((a) => `slide-${a.slideIndex}` === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const removeSlide = (slideIndex: number) => {
    setAssignments((prev) => prev.filter((a) => a.slideIndex !== slideIndex));
  };

  const updateLabel = (slideIndex: number, label: string) => {
    setAssignments((prev) =>
      prev.map((a) => (a.slideIndex === slideIndex ? { ...a, blockLabel: label } : a)),
    );
  };

  const handleConfirm = () => {
    onConfirm({
      title: workoutTitle,
      blocks: assignments,
      totalExercises,
    });
  };

  return (
    <div className="space-y-4" data-testid="carousel-block-assignment">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Arrange Blocks</h2>
        <p className="text-sm text-muted-foreground">
          Drag to reorder, edit block names, or remove slides you no longer need.
        </p>
      </div>

      {/* Sortable list */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={assignments.map((a) => `slide-${a.slideIndex}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {assignments.map((assignment) => (
              <SortableSlideRow
                key={assignment.slideIndex}
                assignment={assignment}
                onRemove={() => removeSlide(assignment.slideIndex)}
                onLabelChange={(label) => updateLabel(assignment.slideIndex, label)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {assignments.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8" data-testid="empty-state">
          No slides remaining. Go back to select slides.
        </p>
      )}

      {/* Merge preview */}
      {assignments.length > 0 && (
        <Card className="bg-muted/30">
          <CardContent className="p-4" data-testid="merge-preview">
            <h3 className="text-sm font-medium mb-2">Merged Workout Preview</h3>
            <p className="text-sm text-muted-foreground">
              <strong>{workoutTitle}</strong> &mdash;{' '}
              {assignments.length} block{assignments.length !== 1 ? 's' : ''},{' '}
              {totalExercises} exercise{totalExercises !== 1 ? 's' : ''}
            </p>
            <ul className="mt-2 text-xs text-muted-foreground space-y-0.5">
              {assignments.map((a, i) => (
                <li key={a.slideIndex}>
                  {i + 1}. {a.blockLabel} ({a.exercises.length} exercises)
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-3 pt-2 border-t">
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        )}
        <Button
          className="ml-auto"
          disabled={assignments.length === 0}
          onClick={handleConfirm}
          data-testid="confirm-merge-btn"
        >
          Merge {assignments.length} block{assignments.length !== 1 ? 's' : ''} into workout
        </Button>
      </div>
    </div>
  );
}
