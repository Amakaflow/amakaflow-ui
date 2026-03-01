/**
 * CompletionDetailView Component (AMA-304)
 *
 * Modal view for workout completion details matching iOS design.
 * Displays execution log data with per-set breakdown, completion ring,
 * stats row, and heart rate graph.
 */

import { useEffect, useState, useMemo } from 'react';
import { X, Watch, Loader2, Check, ChevronRight } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  fetchWorkoutCompletionById,
  WorkoutCompletionDetail,
  ExecutionLog,
  IntervalLog,
  SetLog,
  SetStatus,
  IntervalStatus,
  WeightEntry,
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
          <span className="text-slate-400">bpm AVG</span>
        </span>
        <span className="text-slate-300">
          <span className="text-white font-semibold">{maxHR || '--'}</span>{' '}
          <span className="text-slate-400">bpm MAX</span>
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
// Exercise Badge Colors (matches target design)
// =============================================================================

function getExerciseBadgeColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-blue-500';
    case 'skipped':
      return 'bg-amber-500';
    case 'not_reached':
      return 'bg-slate-400';
    default:
      return 'bg-blue-500';
  }
}

// =============================================================================
// Exercises Table Component (Flat table matching target design)
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

  // AMA-314: Group intervals by exercise name to handle iOS data structure
  // iOS sends one interval per set with set_number:1, so we need to group
  // consecutive intervals with the same planned_name and renumber sets
  type GroupedExercise = {
    name: string;
    status: IntervalStatus;
    sets: Array<SetLog & { intervalDuration?: number }>;
  };

  const groupedExercises: GroupedExercise[] = [];
  let currentGroup: GroupedExercise | null = null;

  exercises.forEach((interval) => {
    const name = interval.planned_name || 'Unknown Exercise';

    // Check if this interval continues the current group (same exercise name)
    if (currentGroup && currentGroup.name === name) {
      // Add sets to current group with renumbered set_number
      const sets = interval.sets || [];
      sets.forEach((set) => {
        const nextSetNumber = currentGroup!.sets.length + 1;
        currentGroup!.sets.push({
          ...set,
          set_number: nextSetNumber,
          intervalDuration: interval.actual_duration_seconds,
        });
      });
    } else {
      // Start a new group
      if (currentGroup) {
        groupedExercises.push(currentGroup);
      }
      const sets = interval.sets || [];
      currentGroup = {
        name,
        status: interval.status,
        sets: sets.map((set, idx) => ({
          ...set,
          set_number: idx + 1,
          intervalDuration: interval.actual_duration_seconds,
        })),
      };
    }
  });

  // Don't forget the last group
  if (currentGroup) {
    groupedExercises.push(currentGroup);
  }

  // Flatten grouped exercises into rows for the table
  type TableRow = {
    exerciseNumber?: number;
    exerciseName?: string;
    exerciseStatus?: string;
    set: SetLog & { intervalDuration?: number };
    isFirstSet: boolean;
    totalSets: number;
  };

  const rows: TableRow[] = [];
  groupedExercises.forEach((exercise, exerciseIdx) => {
    exercise.sets.forEach((set, setIdx) => {
      rows.push({
        exerciseNumber: setIdx === 0 ? exerciseIdx + 1 : undefined,
        exerciseName: setIdx === 0 ? exercise.name : undefined,
        exerciseStatus: setIdx === 0 ? exercise.status : undefined,
        set,
        isFirstSet: setIdx === 0,
        totalSets: exercise.sets.length,
      });
    });
  });

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center py-3 px-4 bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider border-b">
        <div style={{ width: 48 }}></div>
        <div style={{ flex: 1 }}>Exercise</div>
        <div style={{ width: 70 }} className="text-center">SET</div>
        <div style={{ width: 80 }} className="text-center">Reps</div>
        <div style={{ width: 70 }} className="text-center">TIME</div>
        <div style={{ width: 80 }} className="text-center">WEIGHT</div>
        <div style={{ width: 40 }}></div>
      </div>

      {/* Table Rows */}
      {rows.map((row, idx) => (
        <div
          key={idx}
          className={`flex items-center py-3 px-4 text-sm ${
            row.isFirstSet && idx > 0 ? 'border-t' : ''
          }`}
        >
          {/* Exercise Number Badge */}
          <div style={{ width: 48 }}>
            {row.exerciseNumber && (
              <div className={`w-8 h-8 rounded-full ${getExerciseBadgeColor(row.exerciseStatus || 'completed')} flex items-center justify-center`}>
                <span className="text-white font-semibold text-sm">{row.exerciseNumber}</span>
              </div>
            )}
          </div>

          {/* Exercise Name */}
          <div style={{ flex: 1 }} className="font-medium">
            {row.exerciseName || ''}
          </div>

          {/* Set Number */}
          <div style={{ width: 70 }} className="text-center text-muted-foreground">
            Set {row.set.set_number}
          </div>

          {/* Reps */}
          <div style={{ width: 80 }} className="text-center font-medium">
            {row.set.reps_completed !== undefined ? (
              <span>{row.set.reps_completed} reps</span>
            ) : (
              <span className="text-muted-foreground">----</span>
            )}
          </div>

          {/* Time - AMA-314: Fall back to interval duration if set duration missing */}
          <div style={{ width: 70 }} className="text-center text-muted-foreground">
            {formatSetDuration(row.set.duration_seconds ?? row.set.intervalDuration)}
          </div>

          {/* Weight */}
          <div style={{ width: 80 }} className="text-center font-medium">
            {row.set.weight?.display_label || (
              <span className="text-muted-foreground">----</span>
            )}
          </div>

          {/* Status Icon */}
          <div style={{ width: 40 }} className="flex justify-center">
            <SetStatusIcon status={row.set.status} modified={row.set.modified} />
          </div>
        </div>
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
// Mock Data (for when no real execution log exists) - AMA-292
// =============================================================================

// Helper to create weight entry with required components
const mockWeight = (label: string, value: number, unit: 'lbs' | 'kg' = 'lbs'): WeightEntry => ({
  components: [{ source: 'manual', value, unit }],
  display_label: label,
});

const MOCK_INTERVALS: IntervalLog[] = [
  // Incline Smith Machine Press - 4 sets
  {
    interval_index: 0,
    planned_kind: 'reps',
    planned_name: 'Incline Smith Machine Press',
    status: 'completed',
    sets: [
      { set_number: 1, status: 'completed', reps_completed: 12, duration_seconds: 69, weight: mockWeight('35 lbs', 35) },
      { set_number: 2, status: 'completed', reps_completed: 12, duration_seconds: 51, weight: mockWeight('45 lbs', 45) },
      { set_number: 3, status: 'completed', reps_completed: 10, duration_seconds: 88, weight: mockWeight('55 lbs', 55) },
      { set_number: 4, status: 'completed', reps_completed: 8, duration_seconds: 85, weight: mockWeight('55 lbs', 55) },
    ],
  },
  // Dumbbell Lateral Raise - 3 sets
  {
    interval_index: 1,
    planned_kind: 'reps',
    planned_name: 'Dumbbell Lateral Raise',
    status: 'completed',
    sets: [
      { set_number: 1, status: 'completed', reps_completed: 15, duration_seconds: 45, weight: mockWeight('15 lbs', 15) },
      { set_number: 2, status: 'completed', reps_completed: 15, duration_seconds: 45, weight: mockWeight('15 lbs', 15) },
      { set_number: 3, status: 'completed', reps_completed: 12, duration_seconds: 28, weight: mockWeight('15 lbs', 15) },
    ],
  },
  // Cable Fly - skipped
  {
    interval_index: 2,
    planned_kind: 'reps',
    planned_name: 'Cable Fly',
    status: 'skipped',
    skip_reason: 'equipment',
    sets: [
      { set_number: 1, status: 'skipped', weight: mockWeight('Body', 0) },
    ],
  },
  // Bench Dip - 2 sets
  {
    interval_index: 3,
    planned_kind: 'reps',
    planned_name: 'Bench Dip',
    status: 'completed',
    sets: [
      { set_number: 1, status: 'completed', reps_completed: 7, duration_seconds: 45, weight: mockWeight('Body', 0) },
      { set_number: 2, status: 'completed', reps_completed: 8, duration_seconds: 44 },
    ],
  },
  // Tricep Pushdown - not reached
  {
    interval_index: 4,
    planned_kind: 'reps',
    planned_name: 'Tricep Pushdown',
    status: 'not_reached',
    sets: [
      { set_number: 1, status: 'not_reached' },
      { set_number: 2, status: 'not_reached' },
      { set_number: 3, status: 'not_reached' },
    ],
  },
];

const MOCK_SUMMARY = {
  total_intervals: 5,
  completed: 3,
  skipped: 1,
  not_reached: 1,
  completion_percentage: 75,
  total_sets: 13,
  sets_completed: 9,
  sets_skipped: 4,
  total_duration_seconds: 2850,
  active_duration_seconds: 2850,
};

const MOCK_EXECUTION_LOG: ExecutionLog = {
  version: 2,
  intervals: MOCK_INTERVALS,
  summary: MOCK_SUMMARY,
};

// Mock heart rate samples for testing the graph
const MOCK_HR_SAMPLES = [
  { t: 0, bpm: 72 },
  { t: 120, bpm: 85 },
  { t: 240, bpm: 110 },
  { t: 360, bpm: 125 },
  { t: 480, bpm: 140 },
  { t: 600, bpm: 135 },
  { t: 720, bpm: 150 },
  { t: 840, bpm: 158 },
  { t: 960, bpm: 145 },
  { t: 1080, bpm: 130 },
  { t: 1200, bpm: 115 },
  { t: 1320, bpm: 125 },
  { t: 1440, bpm: 140 },
  { t: 1560, bpm: 135 },
  { t: 1680, bpm: 120 },
  { t: 1800, bpm: 105 },
  { t: 1920, bpm: 95 },
  { t: 2040, bpm: 88 },
  { t: 2160, bpm: 82 },
  { t: 2280, bpm: 78 },
];

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

  // Extract data from execution_log or fall back to mock data (AMA-292)
  // Set to true to force mock data for UI testing
  const FORCE_MOCK = false;
  const hasRealExecutionLog = !FORCE_MOCK && completion?.executionLog?.intervals && completion.executionLog.intervals.length > 0;
  console.log('[CompletionDetailView] hasRealExecutionLog:', hasRealExecutionLog, 'FORCE_MOCK:', FORCE_MOCK);
  const executionLog = hasRealExecutionLog ? completion?.executionLog : MOCK_EXECUTION_LOG;
  const summary = executionLog?.summary;

  const completionPercentage = summary?.completion_percentage ?? 100;
  const totalSets = summary?.total_sets ?? 0;
  const setsSkipped = summary?.sets_skipped ?? 0;
  const calories = completion?.activeCalories ?? completion?.totalCalories ?? 161; // Mock fallback
  const avgHR = completion?.avgHeartRate ?? 99; // Mock fallback
  const maxHR = completion?.maxHeartRate ?? 158; // Mock fallback

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
                <div className="bg-muted/30 rounded-xl p-8 flex items-center justify-between">
                  <div
                    className="font-bold tracking-tight"
                    style={{ fontSize: '4.5rem', lineHeight: 1 }}
                  >
                    {formatDuration(completion.durationSeconds)}
                  </div>
                  <CompletionRing percentage={completionPercentage} size={130} />
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
                    samples={FORCE_MOCK ? MOCK_HR_SAMPLES : (completion.heartRateSamples || [])}
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
