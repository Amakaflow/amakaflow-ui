/**
 * CompletionDetailView Component
 *
 * Modal view for workout completion details including health metrics
 * and workout breakdown (intervals).
 */

import { useEffect, useState } from 'react';
import { X, Clock, Heart, Flame, Watch, Footprints, Route, Loader2, Timer, Target, Repeat, Zap } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { fetchWorkoutCompletionById, WorkoutCompletionDetail, IOSCompanionInterval } from '../lib/completions-api';
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

function getSourceDisplayName(source: string): string {
  switch (source) {
    case 'apple_watch':
      return 'Apple Watch';
    case 'garmin':
      return 'Garmin';
    case 'manual':
      return 'Manual';
    default:
      return source;
  }
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

function formatSteps(steps: number): string {
  return steps.toLocaleString();
}

function getIntervalIcon(kind: string) {
  switch (kind) {
    case 'warmup':
      return <Zap className="w-4 h-4 text-orange-500" />;
    case 'cooldown':
      return <Zap className="w-4 h-4 text-blue-500" />;
    case 'time':
      return <Timer className="w-4 h-4 text-green-500" />;
    case 'reps':
      return <Target className="w-4 h-4 text-purple-500" />;
    case 'distance':
      return <Route className="w-4 h-4 text-teal-500" />;
    case 'repeat':
      return <Repeat className="w-4 h-4 text-indigo-500" />;
    default:
      return <Timer className="w-4 h-4 text-muted-foreground" />;
  }
}

function getIntervalKindLabel(kind: string): string {
  switch (kind) {
    case 'warmup':
      return 'Warm-up';
    case 'cooldown':
      return 'Cool-down';
    case 'time':
      return 'Time';
    case 'reps':
      return 'Reps';
    case 'distance':
      return 'Distance';
    case 'repeat':
      return 'Repeat';
    default:
      return kind;
  }
}

// =============================================================================
// Subcomponents
// =============================================================================

function IntervalCard({ interval, index }: { interval: IOSCompanionInterval; index: number }) {
  const hasNestedIntervals = interval.kind === 'repeat' && interval.intervals && interval.intervals.length > 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Interval Header */}
      <div className="bg-muted px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getIntervalIcon(interval.kind)}
          <span className="font-medium">
            {interval.name || `${getIntervalKindLabel(interval.kind)} ${index + 1}`}
          </span>
          <Badge variant="outline" className="text-xs">
            {getIntervalKindLabel(interval.kind)}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {interval.seconds && interval.seconds > 0 && (
            <span>{formatDuration(interval.seconds)}</span>
          )}
          {interval.reps && interval.reps > 0 && (
            <span>{interval.reps} reps</span>
          )}
          {interval.meters && interval.meters > 0 && (
            <span>{formatDistance(interval.meters)}</span>
          )}
        </div>
      </div>

      {/* Interval Details */}
      <div className="p-4 space-y-2">
        <div className="flex flex-wrap gap-2 text-sm">
          {interval.target && (
            <Badge variant="secondary">Target: {interval.target}</Badge>
          )}
          {interval.load && (
            <Badge variant="secondary">Load: {interval.load}</Badge>
          )}
          {interval.restSec && interval.restSec > 0 && (
            <Badge variant="outline">Rest: {interval.restSec}s</Badge>
          )}
        </div>

        {/* Nested intervals for repeat blocks */}
        {hasNestedIntervals && (
          <div className="mt-3 pl-4 border-l-2 border-primary/30 space-y-2">
            <p className="text-xs text-muted-foreground mb-2">Repeat intervals:</p>
            {interval.intervals!.map((nested, nestedIdx) => (
              <div
                key={nestedIdx}
                className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  {getIntervalIcon(nested.kind)}
                  <span>{nested.name || getIntervalKindLabel(nested.kind)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {nested.seconds && <span>{formatDuration(nested.seconds)}</span>}
                  {nested.reps && <span>{nested.reps} reps</span>}
                  {nested.meters && <span>{formatDistance(nested.meters)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
      <div className="mb-2">{icon}</div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
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
                  <h2 className="text-2xl font-semibold mb-2">
                    {completion.workoutName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>{formatDate(completion.startedAt)}</span>
                    <Badge variant="outline" className="text-xs">
                      <Watch className="w-3 h-3 mr-1" />
                      {getSourceDisplayName(completion.source)}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-9 w-9 flex-shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4" style={{ minHeight: 0 }}>
              {/* Health Metrics Summary */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <MetricItem
                    icon={<Clock className="w-6 h-6 text-muted-foreground" />}
                    label="Duration"
                    value={formatDuration(completion.durationSeconds)}
                  />
                  {(completion.avgHeartRate || completion.maxHeartRate) && (
                    <MetricItem
                      icon={<Heart className="w-6 h-6 text-red-500" />}
                      label="Heart Rate"
                      value={completion.avgHeartRate
                        ? `${completion.avgHeartRate}${completion.maxHeartRate ? `/${completion.maxHeartRate}` : ''}`
                        : `${completion.maxHeartRate}`}
                    />
                  )}
                  {(completion.activeCalories || completion.totalCalories) && (
                    <MetricItem
                      icon={<Flame className="w-6 h-6 text-orange-500" />}
                      label="Calories"
                      value={completion.activeCalories
                        ? `${completion.activeCalories}${completion.totalCalories ? ` / ${completion.totalCalories}` : ''}`
                        : `${completion.totalCalories}`}
                    />
                  )}
                  {completion.distanceMeters != null && completion.distanceMeters > 0 && (
                    <MetricItem
                      icon={<Route className="w-6 h-6 text-green-500" />}
                      label="Distance"
                      value={formatDistance(completion.distanceMeters)}
                    />
                  )}
                  {completion.steps != null && completion.steps > 0 && (
                    <MetricItem
                      icon={<Footprints className="w-6 h-6 text-blue-500" />}
                      label="Steps"
                      value={formatSteps(completion.steps)}
                    />
                  )}
                </div>
              </div>

              {/* Workout Breakdown */}
              {completion.intervals && completion.intervals.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3">Workout Breakdown</h3>
                  <div className="space-y-3">
                    {completion.intervals.map((interval, idx) => (
                      <IntervalCard key={idx} interval={interval} index={idx} />
                    ))}
                  </div>
                </div>
              )}

              {/* No intervals message */}
              {(!completion.intervals || completion.intervals.length === 0) && (
                <div className="text-center text-muted-foreground py-8">
                  <p>No workout breakdown available for this completion.</p>
                  <p className="text-sm mt-1">
                    Workout breakdown is available for workouts created in the app.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
