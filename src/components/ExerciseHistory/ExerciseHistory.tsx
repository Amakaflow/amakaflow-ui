/**
 * Exercise History page with 1RM trend visualization.
 *
 * Part of AMA-481: Build Exercise History Page with 1RM Trends
 *
 * Allows users to:
 * - Search and select exercises they've performed
 * - View workout session history with set details
 * - Visualize 1RM progression over time
 * - Filter by date range
 */

import { useState, useMemo } from 'react';
import { Dumbbell, TrendingUp, Trophy, Weight, Activity, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { ExerciseSelector } from './ExerciseSelector';
import { DateRangeFilter, filterByDateRange, type DateRange } from './DateRangeFilter';
import { HistoryTable } from './HistoryTable';
import { OneRmTrendChart } from './OneRmTrendChart';
import {
  useExercisesWithHistory,
  useExerciseHistory,
} from '../../hooks/useProgressionApi';

interface ExerciseHistoryProps {
  user: {
    id: string;
    name: string;
  };
}

function StatsCards({
  allTimeBest1Rm,
  allTimeMaxWeight,
  totalSessions,
  filteredSessionCount,
  isLoading,
}: {
  allTimeBest1Rm: number | null;
  allTimeMaxWeight: number | null;
  totalSessions: number;
  filteredSessionCount: number;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4" data-testid="exercise-history-stats-loading">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-4" data-testid="exercise-history-stats">
      <Card data-testid="stat-card-all-time-1rm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">All-Time Best 1RM</CardTitle>
          <Trophy className="w-4 h-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="stat-value-all-time-1rm">
            {allTimeBest1Rm ? `${Math.round(allTimeBest1Rm)} lbs` : '-'}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="stat-card-max-weight">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Max Weight</CardTitle>
          <Weight className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="stat-value-max-weight">
            {allTimeMaxWeight ? `${allTimeMaxWeight} lbs` : '-'}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="stat-card-total-sessions">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
          <Activity className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="stat-value-total-sessions">{totalSessions}</div>
        </CardContent>
      </Card>

      <Card data-testid="stat-card-in-range">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">In Range</CardTitle>
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="stat-value-in-range">{filteredSessionCount}</div>
          <p className="text-xs text-muted-foreground">sessions</p>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ hasExercises }: { hasExercises: boolean }) {
  if (!hasExercises) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="exercise-history-empty-no-exercises">
        <div className="rounded-full bg-muted p-6 mb-6">
          <Dumbbell className="w-12 h-12 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No Workout History Yet</h3>
        <p className="text-muted-foreground max-w-md mb-6">
          Complete workouts with weight tracking to start seeing your exercise
          history and 1RM progression here.
        </p>
        <Badge variant="outline" className="text-sm">
          Track weight + reps to enable 1RM calculations
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="exercise-history-empty-select-prompt">
      <div className="rounded-full bg-muted p-6 mb-6">
        <TrendingUp className="w-12 h-12 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">Select an Exercise</h3>
      <p className="text-muted-foreground max-w-md">
        Choose an exercise from the dropdown above to view your workout history
        and track your 1RM progression over time.
      </p>
    </div>
  );
}

export function ExerciseHistory({ user }: ExerciseHistoryProps) {
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('all');

  // Fetch exercises that user has performed
  const {
    data: exercisesData,
    isLoading: loadingExercises,
    error: exercisesError,
  } = useExercisesWithHistory({ limit: 100 });

  // Fetch history for selected exercise
  const {
    data: historyData,
    isLoading: loadingHistory,
    error: historyError,
    fetchMore,
    hasMore,
  } = useExerciseHistory({
    exerciseId: selectedExerciseId || '',
    enabled: !!selectedExerciseId,
    limit: 50,
  });

  // Filter sessions by date range
  const filteredSessions = useMemo(
    () => filterByDateRange(historyData?.sessions, dateRange),
    [historyData?.sessions, dateRange]
  );

  const exercises = exercisesData?.exercises || [];
  const hasExercises = exercises.length > 0;

  return (
    <div className="space-y-6" data-testid="exercise-history-page">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="exercise-history-title">
            <TrendingUp className="w-6 h-6" />
            Exercise History
          </h2>
          <p className="text-muted-foreground">
            Track your strength progression and view workout history
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ExerciseSelector
          exercises={exercises}
          selectedExerciseId={selectedExerciseId}
          onSelect={setSelectedExerciseId}
          isLoading={loadingExercises}
        />
        {selectedExerciseId && (
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        )}
      </div>

      {/* Error states */}
      {exercisesError && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4" data-testid="exercise-history-error-exercises">
          Failed to load exercises: {exercisesError.message}
        </div>
      )}
      {historyError && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4" data-testid="exercise-history-error-history">
          Failed to load history: {historyError.message}
        </div>
      )}

      {/* Content */}
      {!selectedExerciseId ? (
        <EmptyState hasExercises={hasExercises} />
      ) : (
        <div className="space-y-6">
          {/* Stats Cards */}
          <StatsCards
            allTimeBest1Rm={historyData?.allTimeBest1Rm || null}
            allTimeMaxWeight={historyData?.allTimeMaxWeight || null}
            totalSessions={historyData?.totalSessions || 0}
            filteredSessionCount={filteredSessions.length}
            isLoading={loadingHistory}
          />

          {/* Exercise Name Badge */}
          {historyData && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-lg py-1 px-3" data-testid="exercise-history-selected-exercise">
                <Dumbbell className="w-4 h-4 mr-2" />
                {historyData.exerciseName}
              </Badge>
              {historyData.supports1Rm && (
                <Badge variant="secondary" className="text-xs" data-testid="exercise-history-1rm-badge">
                  1RM Supported
                </Badge>
              )}
            </div>
          )}

          {/* Chart */}
          <OneRmTrendChart
            sessions={filteredSessions}
            allTimeBest1Rm={historyData?.allTimeBest1Rm || null}
            isLoading={loadingHistory}
          />

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Session History</CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryTable sessions={filteredSessions} isLoading={loadingHistory} />

              {/* Load More */}
              {hasMore && !loadingHistory && (
                <div className="flex justify-center mt-4">
                  <Button variant="outline" onClick={fetchMore} data-testid="exercise-history-load-more">
                    {loadingHistory ? (
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
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
