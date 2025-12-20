/**
 * PreviewStep Component
 *
 * Step 4 of bulk import: Preview workouts before import.
 * Shows workout list with validation issues and allows selection.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useBulkImport } from '../../context/BulkImportContext';
import { useBulkImportApi } from '../../hooks/useBulkImportApi';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import {
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Clock,
  Copy,
  Loader2,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { PreviewWorkout, ValidationIssueSeverity } from '../../types/bulk-import';

interface PreviewStepProps {
  userId: string;
  onStartImport: () => void;
}

// Severity config
const severityConfig: Record<ValidationIssueSeverity, { icon: typeof AlertCircle; color: string; bg: string }> = {
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

export function PreviewStep({ userId, onStartImport }: PreviewStepProps) {
  const { state, dispatch } = useBulkImport();
  const { generatePreview } = useBulkImportApi({ userId });

  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set());

  // Auto-load preview data when component mounts and workouts are empty
  useEffect(() => {
    if (state.preview.workouts.length === 0 && !state.loading && state.jobId) {
      generatePreview();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle workout expansion
  const toggleExpanded = useCallback((id: string) => {
    setExpandedWorkouts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Toggle workout selection
  const toggleSelection = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_WORKOUT_SELECTION', id });
  }, [dispatch]);

  // Select/deselect all
  const toggleSelectAll = useCallback(() => {
    const allSelected = state.preview.workouts.every(w => w.selected);
    if (allSelected) {
      dispatch({ type: 'DESELECT_ALL_WORKOUTS' });
    } else {
      dispatch({ type: 'SELECT_ALL_WORKOUTS' });
    }
  }, [state.preview.workouts, dispatch]);

  // Selected count
  const selectedCount = useMemo(() => {
    return state.preview.workouts.filter(w => w.selected).length;
  }, [state.preview.workouts]);

  // Check if can proceed (has selections and no errors in selected)
  const canProceed = useMemo(() => {
    const selected = state.preview.workouts.filter(w => w.selected);
    if (selected.length === 0) return false;

    const hasErrors = selected.some(w =>
      (w.validationIssues || []).some(i => i.severity === 'error')
    );
    return !hasErrors;
  }, [state.preview.workouts]);

  // Stats from state
  const { stats } = state.preview;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="text-2xl font-bold">{stats.totalSelected}</div>
          <div className="text-sm text-muted-foreground">Workouts Selected</div>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="text-2xl font-bold">{stats.exercisesMatched}</div>
          <div className="text-sm text-muted-foreground">Exercises Matched</div>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{stats.validationErrors}</span>
            {stats.validationErrors > 0 && (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
          </div>
          <div className="text-sm text-muted-foreground">Errors</div>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{stats.validationWarnings}</span>
            {stats.validationWarnings > 0 && (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div className="text-sm text-muted-foreground">Warnings</div>
        </div>
      </div>

      {/* Select All Header */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={state.preview.workouts.length > 0 && state.preview.workouts.every(w => w.selected)}
            onCheckedChange={toggleSelectAll}
          />
          <span className="font-medium">
            {selectedCount} of {state.preview.workouts.length} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          {stats.duplicatesFound > 0 && (
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-400">
              <Copy className="w-3 h-3 mr-1" />
              {stats.duplicatesFound} duplicate{stats.duplicatesFound !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Workout List */}
      <div className="space-y-2">
        {state.preview.workouts.map(workout => {
          const isExpanded = expandedWorkouts.has(workout.id);
          const validationIssues = workout.validationIssues || [];
          const hasErrors = validationIssues.some(i => i.severity === 'error');
          const hasWarnings = validationIssues.some(i => i.severity === 'warning');

          return (
            <div
              key={workout.id}
              className={cn(
                'rounded-xl border transition-all',
                workout.selected
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-white/10 bg-white/[0.02]',
                hasErrors && 'border-red-500/30',
                workout.isDuplicate && 'opacity-60'
              )}
            >
              {/* Main Row */}
              <div className="flex items-center gap-3 p-4">
                {/* Checkbox */}
                <Checkbox
                  checked={workout.selected}
                  onCheckedChange={() => toggleSelection(workout.id)}
                  disabled={hasErrors}
                />

                {/* Expand Button */}
                <button
                  onClick={() => toggleExpanded(workout.id)}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {/* Workout Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{workout.title}</span>
                    {workout.isDuplicate && (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 text-[10px]">
                        Duplicate
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Dumbbell className="w-3 h-3" />
                      {workout.exerciseCount} exercises
                    </span>
                    {workout.estimatedDuration && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {workout.estimatedDuration} min
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Indicators */}
                <div className="flex items-center gap-2">
                  {hasErrors && (
                    <Badge variant="secondary" className="bg-red-500/10 text-red-400">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {validationIssues.filter(i => i.severity === 'error').length}
                    </Badge>
                  )}
                  {hasWarnings && !hasErrors && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-400">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {validationIssues.filter(i => i.severity === 'warning').length}
                    </Badge>
                  )}
                  {!hasErrors && !hasWarnings && (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Ready
                    </Badge>
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-white/5">
                  <div className="pt-4 space-y-4">
                    {/* Validation Issues */}
                    {validationIssues.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Issues</p>
                        <div className="space-y-1">
                          {validationIssues.map((issue, index) => {
                            const config = severityConfig[issue.severity];
                            const IconComponent = config.icon;

                            return (
                              <div
                                key={index}
                                className={cn('flex items-start gap-2 p-2 rounded-lg', config.bg)}
                              >
                                <IconComponent className={cn('w-4 h-4 mt-0.5', config.color)} />
                                <div className="flex-1 min-w-0">
                                  <p className={cn('text-sm', config.color)}>{issue.message}</p>
                                  {issue.suggestion && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Suggestion: {issue.suggestion}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Exercise Preview */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Exercises</p>
                      <div className="grid gap-1">
                        {/* Handle direct exercises from CSV imports */}
                        {workout.workout.exercises?.slice(0, 5).map((exercise, exIndex) => (
                          <div
                            key={`direct-${exIndex}`}
                            className="flex items-center justify-between p-2 rounded bg-white/5 text-sm"
                          >
                            <span className="truncate">{exercise.name || exercise.raw_name || 'Unknown'}</span>
                            <span className="text-muted-foreground flex-shrink-0 ml-2">
                              {exercise.sets && `${exercise.sets}×`}
                              {exercise.reps || exercise.reps_range || ''}
                              {exercise.duration_sec && `${exercise.duration_sec}s`}
                            </span>
                          </div>
                        ))}
                        {(workout.workout.exercises?.length || 0) > 5 && (
                          <p className="text-xs text-muted-foreground pl-2">
                            +{(workout.workout.exercises?.length || 0) - 5} more exercises
                          </p>
                        )}

                        {/* Handle blocks structure from URL/image imports */}
                        {workout.workout.blocks?.slice(0, 2).map((block, blockIndex) => (
                          <div key={`block-${blockIndex}`} className="space-y-1">
                            {block.label && (
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                {block.label}
                              </p>
                            )}
                            {block.exercises?.slice(0, 3).map((exercise, exIndex) => (
                              <div
                                key={exIndex}
                                className="flex items-center justify-between p-2 rounded bg-white/5 text-sm"
                              >
                                <span className="truncate">{exercise.name}</span>
                                <span className="text-muted-foreground flex-shrink-0 ml-2">
                                  {exercise.sets && `${exercise.sets}×`}
                                  {exercise.reps || exercise.reps_range || ''}
                                  {exercise.duration_sec && `${exercise.duration_sec}s`}
                                </span>
                              </div>
                            ))}
                            {(block.exercises?.length || 0) > 3 && (
                              <p className="text-xs text-muted-foreground pl-2">
                                +{(block.exercises?.length || 0) - 3} more exercises
                              </p>
                            )}
                          </div>
                        ))}
                        {(workout.workout.blocks?.length || 0) > 2 && (
                          <p className="text-xs text-muted-foreground">
                            +{(workout.workout.blocks?.length || 0) - 2} more blocks
                          </p>
                        )}

                        {/* Empty state if no exercises found */}
                        {!workout.workout.exercises?.length && !workout.workout.blocks?.length && (
                          <p className="text-xs text-muted-foreground italic">No exercises detected</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {state.preview.workouts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Dumbbell className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No workouts to preview</p>
        </div>
      )}

      {/* Proceed Button */}
      <Button
        onClick={onStartImport}
        disabled={!canProceed || state.loading}
        className="w-full h-12 text-base"
        size="lg"
      >
        {state.loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Preparing Import...
          </>
        ) : canProceed ? (
          <>
            <CheckCircle className="w-5 h-5 mr-2" />
            Import {selectedCount} Workout{selectedCount !== 1 ? 's' : ''}
          </>
        ) : selectedCount === 0 ? (
          <>
            <AlertTriangle className="w-5 h-5 mr-2" />
            Select Workouts to Import
          </>
        ) : (
          <>
            <AlertCircle className="w-5 h-5 mr-2" />
            Fix Errors to Continue
          </>
        )}
      </Button>
    </div>
  );
}

export default PreviewStep;
