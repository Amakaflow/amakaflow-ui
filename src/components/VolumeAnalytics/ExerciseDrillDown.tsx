/**
 * Sheet component showing exercises for a selected muscle group.
 *
 * Part of AMA-483: Volume Analytics Dashboard
 */

import { Dumbbell, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import { Skeleton } from '../ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { useVolumeAnalytics } from '../../hooks/useProgressionApi';
import { getMuscleGroupDisplayName, getMuscleGroupColor, formatVolume } from './constants';
import type { VolumeGranularity } from '../../types/progression';

interface ExerciseDrillDownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  muscleGroup: string | null;
  startDate: string;
  endDate: string;
  granularity: VolumeGranularity;
}

interface ExerciseData {
  exerciseName: string;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
}

/**
 * Aggregates volume data by exercise.
 *
 * TODO(AMA-483): The current API returns data grouped by muscle group and period,
 * not by individual exercises. This function currently shows aggregate totals
 * under "All Exercises". When the API supports exercise-level granularity,
 * update this function to properly group by exercise name.
 */
function aggregateByExercise(data: Array<{
  period: string;
  muscleGroup: string;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
}>): ExerciseData[] {
  if (!data || data.length === 0) {
    return [];
  }

  const aggregate: ExerciseData = {
    exerciseName: 'All Exercises',
    totalVolume: data.reduce((sum, d) => sum + d.totalVolume, 0),
    totalSets: data.reduce((sum, d) => sum + d.totalSets, 0),
    totalReps: data.reduce((sum, d) => sum + d.totalReps, 0),
  };

  return [aggregate];
}

export function ExerciseDrillDown({
  open,
  onOpenChange,
  muscleGroup,
  startDate,
  endDate,
  granularity,
}: ExerciseDrillDownProps) {
  const { data, isLoading, error } = useVolumeAnalytics({
    startDate,
    endDate,
    granularity,
    muscleGroups: muscleGroup ? [muscleGroup] : undefined,
    enabled: open && !!muscleGroup,
  });

  const displayName = muscleGroup ? getMuscleGroupDisplayName(muscleGroup) : '';
  const color = muscleGroup ? getMuscleGroupColor(muscleGroup) : '#64748b';

  const exercises = data?.data ? aggregateByExercise(data.data) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md" data-testid="exercise-drill-down">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3" data-testid="drill-down-title">
            <div
              className="w-4 h-4 rounded-sm"
              style={{ backgroundColor: color }}
            />
            {displayName} Exercises
          </SheetTitle>
          <SheetDescription>
            Volume breakdown for {displayName.toLowerCase()} exercises in the selected period.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-4 pb-4">
          {isLoading && (
            <div className="space-y-3 mt-4" data-testid="drill-down-loading">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}

          {error && (
            <div className="text-destructive text-sm py-4" data-testid="drill-down-error">
              Failed to load exercise data: {error.message}
            </div>
          )}

          {!isLoading && !error && exercises.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-12 text-center"
              data-testid="drill-down-empty"
            >
              <div className="rounded-full bg-muted p-4 mb-4">
                <Dumbbell className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                No exercises found for {displayName.toLowerCase()} in this period.
              </p>
            </div>
          )}

          {!isLoading && !error && exercises.length > 0 && (
            <div className="mt-4 space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold" data-testid="drill-down-volume">
                    {formatVolume(data?.summary?.totalVolume || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Volume (lbs)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold" data-testid="drill-down-sets">
                    {data?.summary?.totalSets || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Sets</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold" data-testid="drill-down-reps">
                    {formatVolume(data?.summary?.totalReps || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Reps</div>
                </div>
              </div>

              {/* Period info */}
              <div className="flex items-center justify-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                </Badge>
              </div>

              {/* Data by period */}
              {data?.data && data.data.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Sets</TableHead>
                      <TableHead className="text-right">Reps</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((point, index) => (
                      <TableRow key={`${point.period}-${index}`}>
                        <TableCell className="font-medium">
                          {new Date(point.period).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatVolume(point.totalVolume)}
                        </TableCell>
                        <TableCell className="text-right">{point.totalSets}</TableCell>
                        <TableCell className="text-right">{point.totalReps}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
