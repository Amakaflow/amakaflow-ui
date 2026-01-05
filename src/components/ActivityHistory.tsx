/**
 * ActivityHistory Component (AMA-196)
 *
 * Displays a list of workout completion records captured from Apple Watch, Garmin, etc.
 * Shows workout name, date, duration, heart rate, and calories for each completion.
 */

import React from 'react';
import { Clock, Heart, Flame, Watch, Loader2, Activity, Footprints, Route } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import type { WorkoutCompletion } from '../lib/completions-api';

// =============================================================================
// Types
// =============================================================================

interface ActivityHistoryProps {
  completions: WorkoutCompletion[];
  loading: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onCompletionClick?: (completionId: string) => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format duration in seconds to MM:SS or HH:MM:SS.
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format date string to human-readable format.
 */
function formatDate(dateString: string): string {
  if (!dateString) return 'Unknown date';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';

    return date.toLocaleDateString('en-US', {
      month: 'short',
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

/**
 * Get display name for source type.
 */
function getSourceDisplayName(source: string): string {
  switch (source) {
    case 'apple_watch':
    case 'ios_companion':
    case 'ios-companion':
      return 'iOS Companion';
    case 'android_companion':
    case 'android-companion':
      return 'Android Companion';
    case 'garmin':
      return 'Garmin';
    case 'manual':
      return 'Manual';
    default:
      return source;
  }
}

/**
 * Format distance in meters to km or miles.
 */
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Format steps with thousands separator.
 */
function formatSteps(steps: number): string {
  return steps.toLocaleString();
}

// =============================================================================
// Subcomponents
// =============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-48 bg-muted rounded" />
              </div>
              <div className="flex gap-4">
                <div className="h-4 w-12 bg-muted rounded" />
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="h-4 w-14 bg-muted rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No activity history yet</h3>
        <p className="text-muted-foreground">
          Complete workouts with the iOS or Android Companion App to see your activity history here.
        </p>
      </CardContent>
    </Card>
  );
}

function CompletionCard({
  completion,
  onClick
}: {
  completion: WorkoutCompletion;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`hover:bg-muted/50 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Top row: Workout name, source, and date */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">{completion.workoutName}</span>
              <Badge variant="outline" className="text-xs">
                <Watch className="w-3 h-3 mr-1" />
                {getSourceDisplayName(completion.source)}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDate(completion.startedAt)}
            </div>
          </div>

          {/* Bottom row: All metrics */}
          <div className="flex items-center gap-4 text-sm flex-wrap">
            {/* Duration */}
            <div className="flex items-center gap-1.5" title="Duration">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{formatDuration(completion.durationSeconds)}</span>
            </div>

            {/* Steps */}
            {completion.steps != null && completion.steps > 0 && (
              <div className="flex items-center gap-1.5" title="Steps">
                <Footprints className="w-4 h-4 text-blue-500" />
                <span>
                  <span className="font-medium">{formatSteps(completion.steps)}</span>
                  <span className="text-muted-foreground ml-1">steps</span>
                </span>
              </div>
            )}

            {/* Distance */}
            {completion.distanceMeters != null && completion.distanceMeters > 0 && (
              <div className="flex items-center gap-1.5" title="Distance">
                <Route className="w-4 h-4 text-green-500" />
                <span className="font-medium">{formatDistance(completion.distanceMeters)}</span>
              </div>
            )}

            {/* Heart Rate */}
            {(completion.avgHeartRate || completion.maxHeartRate) && (
              <div className="flex items-center gap-1.5" title="Heart Rate (avg/max)">
                <Heart className="w-4 h-4 text-red-500" />
                <span>
                  {completion.avgHeartRate && (
                    <span className="font-medium">{completion.avgHeartRate}</span>
                  )}
                  {completion.avgHeartRate && completion.maxHeartRate && '/'}
                  {completion.maxHeartRate && (
                    <span>{completion.maxHeartRate}</span>
                  )}
                  <span className="text-muted-foreground ml-1">bpm</span>
                </span>
              </div>
            )}

            {/* Calories - show active and total if both available */}
            {(completion.activeCalories || completion.totalCalories) && (
              <div className="flex items-center gap-1.5" title={completion.totalCalories ? "Active / Total Calories" : "Active Calories"}>
                <Flame className="w-4 h-4 text-orange-500" />
                <span>
                  {completion.activeCalories && (
                    <span className="font-medium">{completion.activeCalories}</span>
                  )}
                  {completion.activeCalories && completion.totalCalories && (
                    <span className="text-muted-foreground"> / {completion.totalCalories}</span>
                  )}
                  {!completion.activeCalories && completion.totalCalories && (
                    <span className="font-medium">{completion.totalCalories}</span>
                  )}
                  <span className="text-muted-foreground ml-1">cal</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ActivityHistory({
  completions,
  loading,
  onLoadMore,
  hasMore = false,
  onCompletionClick,
}: ActivityHistoryProps) {
  if (loading && completions.length === 0) {
    return <LoadingSkeleton />;
  }

  if (!loading && completions.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-3">
      {completions.map((completion) => (
        <CompletionCard
          key={completion.id}
          completion={completion}
          onClick={onCompletionClick ? () => onCompletionClick(completion.id) : undefined}
        />
      ))}

      {/* Load More button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
