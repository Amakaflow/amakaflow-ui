/**
 * Volume Analytics Dashboard showing training volume by muscle group.
 *
 * Part of AMA-483: Volume Analytics Dashboard
 *
 * Features:
 * - Period selection (weekly/monthly/quarterly)
 * - Summary cards with period comparison
 * - Stacked bar chart by muscle group
 * - Push/pull and upper/lower balance indicators
 * - Muscle group breakdown with drill-down
 */

import { useState, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { PeriodSelector, getPeriodDates, type VolumePeriod } from './PeriodSelector';
import { VolumeSummaryCards } from './VolumeSummaryCards';
import { VolumeBarChart } from './VolumeBarChart';
import { BalanceIndicators } from './BalanceIndicators';
import { MuscleGroupBreakdown } from './MuscleGroupBreakdown';
import { ExerciseDrillDown } from './ExerciseDrillDown';
import { useVolumeAnalytics } from '../../hooks/useProgressionApi';

interface VolumeAnalyticsProps {
  /** User context - reserved for future personalization features */
  user: {
    id: string;
    name: string;
  };
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid="volume-analytics-empty"
    >
      <div className="rounded-full bg-muted p-6 mb-6">
        <BarChart3 className="w-12 h-12 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">No Volume Data Yet</h3>
      <p className="text-muted-foreground max-w-md mb-6">
        Complete workouts with tracked weight and reps to start seeing your
        training volume analytics here.
      </p>
      <Badge variant="outline" className="text-sm">
        Volume = Weight x Reps per set
      </Badge>
    </div>
  );
}

export function VolumeAnalytics({ user: _user }: VolumeAnalyticsProps) {
  const [period, setPeriod] = useState<VolumePeriod>('weekly');
  const [drillDownMuscleGroup, setDrillDownMuscleGroup] = useState<string | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  // Calculate date ranges for current and previous periods (memoized)
  const { current, previous, granularity } = useMemo(
    () => getPeriodDates(period),
    [period]
  );

  // Fetch volume analytics for current period
  const {
    data: currentData,
    isLoading: loadingCurrent,
    error: currentError,
  } = useVolumeAnalytics({
    startDate: current.startDate,
    endDate: current.endDate,
    granularity,
  });

  // Fetch volume analytics for previous period (for comparison)
  const {
    data: previousData,
    isLoading: loadingPrevious,
  } = useVolumeAnalytics({
    startDate: previous.startDate,
    endDate: previous.endDate,
    granularity,
  });

  const isLoading = loadingCurrent || loadingPrevious;
  const hasData = currentData?.data && currentData.data.length > 0;

  const handleMuscleGroupClick = (muscleGroup: string) => {
    setDrillDownMuscleGroup(muscleGroup);
    setDrillDownOpen(true);
  };

  return (
    <div className="space-y-6" data-testid="volume-analytics-page">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="volume-analytics-title">
            <BarChart3 className="w-6 h-6" />
            Volume Analytics
          </h2>
          <p className="text-muted-foreground">
            Track your training volume by muscle group over time
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Error state */}
      {currentError && (
        <div
          className="bg-destructive/10 text-destructive rounded-lg p-4"
          data-testid="volume-analytics-error"
        >
          Failed to load volume data: {currentError.message}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !currentError && !hasData && <EmptyState />}

      {/* Content */}
      {(isLoading || hasData) && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <VolumeSummaryCards
            current={currentData?.summary || null}
            previous={previousData?.summary || null}
            isLoading={isLoading}
          />

          {/* Bar Chart */}
          <VolumeBarChart
            data={currentData?.data || []}
            granularity={granularity}
            isLoading={loadingCurrent}
            onMuscleGroupClick={handleMuscleGroupClick}
          />

          {/* Balance Indicators */}
          <BalanceIndicators
            muscleGroupBreakdown={currentData?.summary?.muscleGroupBreakdown || null}
            isLoading={loadingCurrent}
          />

          {/* Muscle Group Breakdown */}
          <MuscleGroupBreakdown
            current={currentData?.summary?.muscleGroupBreakdown || null}
            previous={previousData?.summary?.muscleGroupBreakdown || null}
            isLoading={isLoading}
            onMuscleGroupClick={handleMuscleGroupClick}
          />
        </div>
      )}

      {/* Drill-down Sheet */}
      <ExerciseDrillDown
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        muscleGroup={drillDownMuscleGroup}
        startDate={current.startDate}
        endDate={current.endDate}
        granularity={granularity}
      />
    </div>
  );
}
