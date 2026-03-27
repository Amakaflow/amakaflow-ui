/**
 * AMA-210: Mid-workout flexibility component.
 *
 * During workout playback, allows the user to:
 * - Skip the current exercise
 * - Reorder remaining exercises
 * - Replace the current exercise with an alternative
 */

import { useState, useCallback } from 'react';
import { SkipForward, ArrowUpDown, Replace, ChevronDown, ChevronUp, X, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import type { Exercise, Block } from '../types/workout';
import type {
  SkipReason,
  SkipResult,
  ReplaceResult,
  ReorderResult,
  PlaybackModification,
  AlternativeExercise,
} from '../types/workout-playback';

const SKIP_REASONS: { value: SkipReason; label: string }[] = [
  { value: 'equipment_unavailable', label: 'Equipment unavailable' },
  { value: 'injury', label: 'Injury / discomfort' },
  { value: 'fatigue', label: 'Too fatigued' },
  { value: 'time_constraint', label: 'Short on time' },
  { value: 'user_choice', label: 'Other' },
];

interface MidWorkoutActionsProps {
  /** The exercise currently being performed */
  currentExercise: Exercise;
  /** Index of the current step */
  currentStepIndex: number;
  /** All remaining exercises (after current) */
  remainingExercises: Exercise[];
  /** Alternative exercises for replacement */
  alternatives?: AlternativeExercise[];
  /** Called when user performs a modification */
  onModification: (modification: PlaybackModification) => void;
  /** Whether the panel is expanded */
  isExpanded?: boolean;
  className?: string;
}

type ActivePanel = null | 'skip' | 'reorder' | 'replace';

export function MidWorkoutActions({
  currentExercise,
  currentStepIndex,
  remainingExercises,
  alternatives = [],
  onModification,
  isExpanded: initialExpanded = false,
  className,
}: MidWorkoutActionsProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // --- Skip ---
  const handleSkip = useCallback((reason: SkipReason) => {
    const result: SkipResult = {
      action: 'skip',
      exerciseId: currentExercise.id,
      exerciseName: currentExercise.name,
      reason,
    };
    onModification(result);
    setActivePanel(null);
  }, [currentExercise, onModification]);

  // --- Replace ---
  const handleReplace = useCallback((alternative: AlternativeExercise) => {
    const result: ReplaceResult = {
      action: 'replace',
      originalExerciseId: currentExercise.id,
      originalName: currentExercise.name,
      replacementExercise: alternative.exercise,
      reason: alternative.reason,
    };
    onModification(result);
    setActivePanel(null);
  }, [currentExercise, onModification]);

  // --- Reorder ---
  const handleMoveExerciseUp = useCallback((exerciseIndex: number) => {
    if (exerciseIndex <= 0) return;
    const ids = remainingExercises.map(e => e.id);
    [ids[exerciseIndex], ids[exerciseIndex - 1]] = [ids[exerciseIndex - 1], ids[exerciseIndex]];
    const result: ReorderResult = {
      action: 'reorder',
      newOrder: ids,
    };
    onModification(result);
  }, [remainingExercises, onModification]);

  const togglePanel = useCallback((panel: ActivePanel) => {
    setActivePanel(prev => prev === panel ? null : panel);
  }, []);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={cn(
          'flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors',
          className
        )}
        data-testid="mid-workout-actions-toggle"
      >
        <ChevronUp className="w-3.5 h-3.5" />
        Modify workout
      </button>
    );
  }

  return (
    <div className={cn('rounded-lg border bg-background', className)} data-testid="mid-workout-actions">
      {/* Toggle header */}
      <button
        onClick={() => { setIsExpanded(false); setActivePanel(null); }}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
      >
        <span>Modify Workout</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {/* Action buttons */}
      <div className="flex gap-2 px-3 pb-2">
        <Button
          variant={activePanel === 'skip' ? 'default' : 'outline'}
          size="sm"
          onClick={() => togglePanel('skip')}
          data-testid="mid-workout-skip-btn"
        >
          <SkipForward className="w-3.5 h-3.5 mr-1" />
          Skip
        </Button>
        <Button
          variant={activePanel === 'reorder' ? 'default' : 'outline'}
          size="sm"
          onClick={() => togglePanel('reorder')}
          disabled={remainingExercises.length < 2}
          data-testid="mid-workout-reorder-btn"
        >
          <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
          Reorder
        </Button>
        <Button
          variant={activePanel === 'replace' ? 'default' : 'outline'}
          size="sm"
          onClick={() => togglePanel('replace')}
          disabled={alternatives.length === 0}
          data-testid="mid-workout-replace-btn"
        >
          <Replace className="w-3.5 h-3.5 mr-1" />
          Replace
        </Button>
      </div>

      {/* Skip panel */}
      {activePanel === 'skip' && (
        <div className="px-3 pb-3 border-t pt-2" data-testid="skip-panel">
          <p className="text-xs text-muted-foreground mb-2">
            Skip "{currentExercise.name}" -- why?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SKIP_REASONS.map(r => (
              <Button
                key={r.value}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handleSkip(r.value)}
                data-testid={`skip-reason-${r.value}`}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Reorder panel */}
      {activePanel === 'reorder' && (
        <div className="px-3 pb-3 border-t pt-2" data-testid="reorder-panel">
          <p className="text-xs text-muted-foreground mb-2">
            Reorder remaining exercises:
          </p>
          <ul className="space-y-1">
            {remainingExercises.map((ex, i) => (
              <li key={ex.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted">
                <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                <span className="flex-1 truncate">{ex.name}</span>
                <button
                  disabled={i === 0}
                  onClick={() => handleMoveExerciseUp(i)}
                  className="p-0.5 rounded hover:bg-muted-foreground/20 disabled:opacity-30"
                  aria-label={`Move ${ex.name} up`}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Replace panel */}
      {activePanel === 'replace' && (
        <div className="px-3 pb-3 border-t pt-2" data-testid="replace-panel">
          <p className="text-xs text-muted-foreground mb-2">
            Replace "{currentExercise.name}" with:
          </p>
          {alternatives.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <AlertCircle className="w-3.5 h-3.5" />
              No alternatives available
            </div>
          ) : (
            <ul className="space-y-1.5">
              {alternatives.map((alt, i) => (
                <li key={i}>
                  <button
                    onClick={() => handleReplace(alt)}
                    className="w-full flex items-center gap-2 text-left text-sm py-2 px-2 rounded hover:bg-muted"
                    data-testid={`replace-option-${i}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium">{alt.exercise.name}</p>
                      <p className="text-xs text-muted-foreground">{alt.reason}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {Math.round(alt.similarity * 100)}%
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
