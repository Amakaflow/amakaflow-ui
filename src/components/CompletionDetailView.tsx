/**
 * CompletionDetailView Component (AMA-304)
 *
 * Modal view for workout completion details matching iOS design.
 * Displays execution log data with per-set breakdown, completion ring,
 * stats row, and heart rate graph.
 */

import { useEffect, useState, useMemo } from 'react';
import { X, Watch, Loader2, Check, ChevronRight, AlertCircle } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  fetchWorkoutCompletionById,
  WorkoutCompletionDetail,
  ExecutionLog,
  IntervalLog,
  SetLog,
  SetStatus,
} from '../lib/completions-api';
import { formatDuration } from './ActivityHistory';

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(dateString: string): string {
  if (!dateString) return 'Unknown date';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }) + ' at ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid date';
  }
}

function formatTimeRange(startedAt: string, endedAt: string): string {
  if (!startedAt) return '';
  try {
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : null;

    const startTime = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    if (end && !isNaN(end.getTime())) {
      const endTime = end.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      return `${startTime} - ${endTime}`;
    }

    return startTime;
  } catch {
    return '';
  }
}

function formatSetDuration(seconds: number | undefined): string {
  if (!seconds) return '----';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getSourceDisplayName(source: string): string {
  switch (source) {
    case 'apple_watch':
      return 'Apple Watch';
    case 'garmin':
      return 'Garmin';
    case 'ios_companion':
      return 'iOS Companion';
    case 'android_companion':
      return 'Android Companion';
    case 'manual':
      return 'Manual';
    default:
      return source;
  }
}

// =============================================================================
// Completion Percentage Ring Component
// =============================================================================

interface CompletionRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

function CompletionRing({ percentage, size = 120, strokeWidth = 8 }: CompletionRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  // Color based on percentage
  const getColor = () => {
    if (percentage >= 80) return '#22c55e'; // green-500
    if (percentage >= 50) return '#f59e0b'; // amber-500
    return '#ef4444'; // red-500
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{percentage}%</span>
        <span className="text-xs text-muted-foreground">complete</span>
      </div>
    </div>
  );
}

// =============================================================================
// Heart Rate Graph Component
// =============================================================================

interface HeartRateGraphProps {
  samples: Array<{ t: number; bpm: number }>;
  avgHR?: number;
  maxHR?: number;
}

function HeartRateGraph({ samples, avgHR, maxHR }: HeartRateGraphProps) {
  const { path } = useMemo(() => {
    if (!samples || samples.length < 2) {
      return { path: '' };
    }

    const sortedSamples = [...samples].sort((a, b) => a.t - b.t);
    const bpmValues = sortedSamples.map((s) => s.bpm);
    const minBpm = Math.min(...bpmValues) - 10;
    const maxBpmVal = Math.max(...bpmValues) + 10;
    const bpmRange = maxBpmVal - minBpm;

    const width = 100;
    const height = 60;
    const timeRange = sortedSamples[sortedSamples.length - 1].t - sortedSamples[0].t;

    const points = sortedSamples.map((sample, i) => {
      const x = timeRange > 0
        ? ((sample.t - sortedSamples[0].t) / timeRange) * width
        : (i / (sortedSamples.length - 1)) * width;
      const y = height - ((sample.bpm - minBpm) / bpmRange) * height;
      return `${x},${y}`;
    });

    return {
      path: `M ${points.join(' L ')}`,
    };
  }, [samples]);

  if (!samples || samples.length < 2) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 h-28 flex items-center justify-center">
        <span className="text-slate-400 text-sm">No heart rate data</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      {/* Graph */}
      <div className="h-16 mb-2">
        <svg viewBox="0 0 100 60" className="w-full h-full" preserveAspectRatio="none">
          <path
            d={path}
            fill="none"
            stroke="#f97316"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      {/* Stats */}
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">
          <span className="text-white font-semibold">{avgHR || '--'}</span>{' '}
          <span className="text-slate-400">AVG</span>
        </span>
        <span className="text-slate-300">
          <span className="text-white font-semibold">{maxHR || '--'}</span>{' '}
          <span className="text-slate-400">MAX</span>
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// Stats Row Component
// =============================================================================

interface StatsRowProps {
  sets?: number;
  skipped?: number;
  calories?: number;
  avgHR?: number;
}

function StatsRow({ sets, skipped, calories, avgHR }: StatsRowProps) {
  return (
    <div className="flex items-center justify-between text-sm border-b pb-3 mb-3">
      {sets !== undefined && (
        <div className="text-center">
          <span className="text-2xl font-bold text-foreground">{sets}</span>
          <span className="text-muted-foreground ml-1">Sets</span>
        </div>
      )}
      {skipped !== undefined && skipped > 0 && (
        <div className="text-center border-l pl-4">
          <span className="text-2xl font-bold text-amber-500">{skipped}</span>
          <span className="text-muted-foreground ml-1">Skipped</span>
        </div>
      )}
      {calories !== undefined && (
        <div className="text-center border-l pl-4">
          <span className="text-2xl font-bold text-foreground">{calories}</span>
          <span className="text-muted-foreground ml-1">CAL</span>
        </div>
      )}
      {avgHR !== undefined && (
        <div className="text-center border-l pl-4">
          <span className="text-2xl font-bold text-foreground">{avgHR}</span>
          <span className="text-muted-foreground ml-1">°HR</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Set Status Icon Component
// =============================================================================

interface SetStatusIconProps {
  status: SetStatus;
  modified?: boolean;
}

function SetStatusIcon({ status, modified }: SetStatusIconProps) {
  if (status === 'completed') {
    if (modified) {
      // Half-filled circle for modified
      return (
        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-amber-500" style={{ clipPath: 'inset(0 50% 0 0)' }} />
        </div>
      );
    }
    // Green checkmark for completed
    return (
      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
        <Check className="w-4 h-4 text-white" />
      </div>
    );
  }

  if (status === 'skipped') {
    // Orange question mark for skipped
    return (
      <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
        <span className="text-white text-sm font-bold">?</span>
      </div>
    );
  }

  // Gray chevron for not_reached
  return (
    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </div>
  );
}

// =============================================================================
// Exercise Row Component
// =============================================================================

interface ExerciseRowProps {
  interval: IntervalLog;
  exerciseNumber: number;
}

function ExerciseRow({ interval, exerciseNumber }: ExerciseRowProps) {
  const sets = interval.sets || [];

  return (
    <div className="border-b last:border-b-0">
      {/* Exercise Header */}
      <div className="flex items-center gap-3 py-3 px-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <span className="text-primary font-semibold">{exerciseNumber}</span>
        </div>
        <span className="font-medium">{interval.planned_name}</span>
      </div>

      {/* Sets Table */}
      {sets.length > 0 && (
        <div className="pl-12 pr-2 pb-3">
          {sets.map((set) => (
            <div
              key={set.set_number}
              className="grid grid-cols-5 gap-2 py-2 text-sm items-center border-t first:border-t-0"
            >
              {/* Set Number */}
              <div className="text-muted-foreground">
                Set {set.set_number}
              </div>

              {/* Reps */}
              <div className="text-center">
                {set.status === 'completed' || set.status === 'skipped' ? (
                  set.reps_completed !== undefined ? (
                    <span>{set.reps_completed} reps</span>
                  ) : (
                    <span className="text-muted-foreground">----</span>
                  )
                ) : (
                  <span className="text-muted-foreground">----</span>
                )}
              </div>

              {/* Time */}
              <div className="text-center text-muted-foreground">
                {formatSetDuration(set.duration_seconds)}
              </div>

              {/* Weight */}
              <div className="text-center">
                {set.weight?.display_label || (
                  <span className="text-muted-foreground">----</span>
                )}
              </div>

              {/* Status Icon */}
              <div className="flex justify-end">
                <SetStatusIcon status={set.status} modified={set.modified} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skip reason */}
      {interval.status === 'skipped' && interval.skip_reason && (
        <div className="pl-12 pb-3">
          <span className="text-amber-500 text-sm flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Skipped: {interval.skip_reason}
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Exercises Table Component
// =============================================================================

interface ExercisesTableProps {
  intervals: IntervalLog[];
}

function ExercisesTable({ intervals }: ExercisesTableProps) {
  // Filter to only reps intervals (exercises with sets)
  const exercises = intervals.filter((i) => i.planned_kind === 'reps' || i.sets?.length);

  if (exercises.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No exercise data available.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-5 gap-2 py-2 px-2 bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider">
        <div className="pl-12">Set # or LB</div>
        <div className="text-center">Reps</div>
        <div className="text-center">Time</div>
        <div className="text-center">Weight</div>
        <div></div>
      </div>

      {/* Exercise Rows */}
      {exercises.map((interval, idx) => (
        <ExerciseRow
          key={interval.interval_index}
          interval={interval}
          exerciseNumber={idx + 1}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Legacy Interval Display (for completions without execution_log)
// =============================================================================

interface LegacyIntervalDisplayProps {
  intervals: Array<{
    kind?: string;
    type?: string;
    seconds?: number;
    target?: string;
    reps?: number;
    name?: string;
    load?: string;
    restSec?: number;
    meters?: number;
  }>;
}

function LegacyIntervalDisplay({ intervals }: LegacyIntervalDisplayProps) {
  return (
    <div className="space-y-2">
      {intervals.map((interval, idx) => {
        const kind = interval.kind || interval.type || 'time';
        return (
          <div key={idx} className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{interval.name || `${kind} ${idx + 1}`}</span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {interval.seconds && <span>{formatDuration(interval.seconds)}</span>}
                {interval.reps && <span>{interval.reps} reps</span>}
              </div>
            </div>
            {(interval.target || interval.load) && (
              <div className="mt-2 flex gap-2">
                {interval.target && <Badge variant="secondary">Target: {interval.target}</Badge>}
                {interval.load && <Badge variant="secondary">Load: {interval.load}</Badge>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface CompletionDetailViewProps {
  completionId: string;
  onClose: () => void;
}

export function CompletionDetailView({ completionId, onClose }: CompletionDetailViewProps) {
  const [completion, setCompletion] = useState<WorkoutCompletionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCompletion() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchWorkoutCompletionById(completionId);
        setCompletion(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load completion');
      } finally {
        setLoading(false);
      }
    }

    loadCompletion();
  }, [completionId]);

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Extract data from execution_log or fall back to completion fields
  const executionLog = completion?.executionLog;
  const summary = executionLog?.summary;

  const completionPercentage = summary?.completion_percentage ?? 100;
  const totalSets = summary?.total_sets ?? 0;
  const setsSkipped = summary?.sets_skipped ?? 0;
  const calories = summary?.calories ?? completion?.activeCalories ?? completion?.totalCalories;
  const avgHR = summary?.avg_heart_rate ?? completion?.avgHeartRate;
  const maxHR = summary?.max_heart_rate ?? completion?.maxHeartRate;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-background rounded-lg shadow-lg w-full max-w-3xl flex flex-col"
        style={{
          maxHeight: '90vh',
          height: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading State */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )}

        {/* Content */}
        {completion && !loading && (
          <>
            {/* Fixed Header */}
            <div className="border-b px-6 py-4 flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-semibold mb-1">
                    {completion.workoutName}
                  </h2>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(completion.startedAt).split(' at ')[0]}
                    {' '}
                    {formatTimeRange(completion.startedAt, completion.endedAt)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="flex-shrink-0"
                >
                  Done <X className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4" style={{ minHeight: 0 }}>
              {/* Summary Section - 2 Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Left: Duration + Completion Ring */}
                <div className="bg-muted/30 rounded-xl p-6 flex items-center justify-between">
                  <div>
                    <div className="text-5xl font-bold tracking-tight">
                      {formatDuration(completion.durationSeconds)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {Math.round(completion.durationSeconds / 60)} mins
                    </div>
                  </div>
                  <CompletionRing percentage={completionPercentage} />
                </div>

                {/* Right: Stats + HR Graph */}
                <div className="space-y-3">
                  <StatsRow
                    sets={totalSets}
                    skipped={setsSkipped}
                    calories={calories}
                    avgHR={avgHR}
                  />
                  <HeartRateGraph
                    samples={completion.heartRateSamples || []}
                    avgHR={avgHR}
                    maxHR={maxHR}
                  />
                </div>
              </div>

              {/* Exercises Section */}
              <div>
                <h3 className="text-lg font-medium mb-3">Exercises</h3>

                {/* Use execution_log if available, otherwise fall back to legacy intervals */}
                {executionLog && executionLog.intervals.length > 0 ? (
                  <ExercisesTable intervals={executionLog.intervals} />
                ) : completion.intervals && completion.intervals.length > 0 ? (
                  <LegacyIntervalDisplay intervals={completion.intervals} />
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p>No workout breakdown available for this completion.</p>
                    <p className="text-sm mt-1">
                      Workout breakdown is available for workouts created in the app.
                    </p>
                  </div>
                )}
              </div>

              {/* Source Footer */}
              <div className="mt-6 pt-4 border-t">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Watch className="w-4 h-4" />
                    <span>Source: {getSourceDisplayName(completion.source)}</span>
                  </div>
                  {completion.sourceWorkoutId && (
                    <Badge variant="outline" className="text-xs">
                      Synced
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
