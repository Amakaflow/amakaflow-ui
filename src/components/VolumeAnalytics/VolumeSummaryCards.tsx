/**
 * Summary cards showing volume statistics with period comparison.
 *
 * Part of AMA-483: Volume Analytics Dashboard
 */

import { Weight, Layers, Hash, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { formatVolume } from './constants';
import { ChangeIndicator } from './ChangeIndicator';
import type { VolumeSummary } from '../../types/progression';

interface VolumeSummaryCardsProps {
  current: VolumeSummary | null;
  previous: VolumeSummary | null;
  isLoading?: boolean;
}

function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

export function VolumeSummaryCards({ current, previous, isLoading }: VolumeSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4" data-testid="volume-summary-loading">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-12 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const totalVolume = current?.totalVolume || 0;
  const totalSets = current?.totalSets || 0;
  const totalReps = current?.totalReps || 0;
  const activeMuscleGroups = Object.keys(current?.muscleGroupBreakdown || {}).length;

  const prevTotalVolume = previous?.totalVolume || 0;
  const prevTotalSets = previous?.totalSets || 0;
  const prevTotalReps = previous?.totalReps || 0;
  const prevActiveMuscleGroups = Object.keys(previous?.muscleGroupBreakdown || {}).length;

  const volumeChange = calculatePercentChange(totalVolume, prevTotalVolume);
  const setsChange = calculatePercentChange(totalSets, prevTotalSets);
  const repsChange = calculatePercentChange(totalReps, prevTotalReps);
  const muscleGroupsChange = calculatePercentChange(activeMuscleGroups, prevActiveMuscleGroups);

  return (
    <div className="grid gap-4 md:grid-cols-4" data-testid="volume-summary-cards">
      <Card data-testid="stat-card-total-volume">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
          <Weight className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="stat-value-total-volume">
            {formatVolume(totalVolume)} lbs
          </div>
          <div className="flex items-center gap-2 mt-1">
            <ChangeIndicator change={volumeChange} />
            <span className="text-xs text-muted-foreground">vs previous</span>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="stat-card-total-sets">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Sets</CardTitle>
          <Layers className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="stat-value-total-sets">
            {totalSets.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <ChangeIndicator change={setsChange} />
            <span className="text-xs text-muted-foreground">vs previous</span>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="stat-card-total-reps">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Reps</CardTitle>
          <Hash className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="stat-value-total-reps">
            {formatVolume(totalReps)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <ChangeIndicator change={repsChange} />
            <span className="text-xs text-muted-foreground">vs previous</span>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="stat-card-muscle-groups">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Muscle Groups</CardTitle>
          <Target className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="stat-value-muscle-groups">
            {activeMuscleGroups}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <ChangeIndicator change={muscleGroupsChange} />
            <span className="text-xs text-muted-foreground">vs previous</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
