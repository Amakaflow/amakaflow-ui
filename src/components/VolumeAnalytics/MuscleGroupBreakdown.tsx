/**
 * Muscle group breakdown table with percentage and change indicators.
 *
 * Part of AMA-483: Volume Analytics Dashboard
 */

import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Progress } from '../ui/progress';
import { getMuscleGroupDisplayName, getMuscleGroupColor, formatVolume } from './constants';
import { ChangeIndicator } from './ChangeIndicator';

interface MuscleGroupBreakdownProps {
  current: Record<string, number> | null;
  previous: Record<string, number> | null;
  isLoading?: boolean;
  onMuscleGroupClick?: (muscleGroup: string) => void;
}

interface MuscleGroupRow {
  muscleGroup: string;
  displayName: string;
  volume: number;
  percentage: number;
  change: number | null;
  color: string;
}

function calculateChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function prepareRows(
  current: Record<string, number>,
  previous: Record<string, number> | null
): MuscleGroupRow[] {
  const totalVolume = Object.values(current).reduce((sum, v) => sum + v, 0);

  return Object.entries(current)
    .map(([muscleGroup, volume]) => ({
      muscleGroup,
      displayName: getMuscleGroupDisplayName(muscleGroup),
      volume,
      percentage: totalVolume > 0 ? (volume / totalVolume) * 100 : 0,
      change: previous ? calculateChange(volume, previous[muscleGroup] || 0) : null,
      color: getMuscleGroupColor(muscleGroup),
    }))
    .sort((a, b) => b.volume - a.volume);
}

export function MuscleGroupBreakdown({
  current,
  previous,
  isLoading,
  onMuscleGroupClick,
}: MuscleGroupBreakdownProps) {
  if (isLoading) {
    return (
      <Card data-testid="muscle-group-breakdown">
        <CardHeader>
          <CardTitle data-testid="muscle-group-breakdown-title">Muscle Group Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3" data-testid="muscle-group-breakdown-loading">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!current || Object.keys(current).length === 0) {
    return (
      <Card data-testid="muscle-group-breakdown">
        <CardHeader>
          <CardTitle data-testid="muscle-group-breakdown-title">Muscle Group Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="text-muted-foreground text-sm py-8 text-center"
            data-testid="muscle-group-breakdown-empty"
          >
            No volume data available for this period
          </div>
        </CardContent>
      </Card>
    );
  }

  const rows = prepareRows(current, previous);

  return (
    <Card data-testid="muscle-group-breakdown">
      <CardHeader>
        <CardTitle data-testid="muscle-group-breakdown-title">Muscle Group Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Muscle Group</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right w-[120px]">% of Total</TableHead>
              <TableHead className="text-right w-[100px]">Change</TableHead>
              {onMuscleGroupClick && <TableHead className="w-[40px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.muscleGroup}
                className={onMuscleGroupClick ? 'cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none' : ''}
                tabIndex={onMuscleGroupClick ? 0 : undefined}
                role={onMuscleGroupClick ? 'button' : undefined}
                aria-label={onMuscleGroupClick ? `View ${row.displayName} exercises` : undefined}
                onClick={onMuscleGroupClick ? () => onMuscleGroupClick(row.muscleGroup) : undefined}
                onKeyDown={onMuscleGroupClick ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onMuscleGroupClick(row.muscleGroup);
                  }
                } : undefined}
                data-testid={`muscle-group-row-${row.muscleGroup}`}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="font-medium">{row.displayName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatVolume(row.volume)} lbs
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <Progress
                      value={row.percentage}
                      className="w-16 h-2"
                      style={
                        {
                          '--progress-background': row.color,
                        } as React.CSSProperties
                      }
                    />
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {row.percentage.toFixed(1)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <ChangeIndicator change={row.change} />
                </TableCell>
                {onMuscleGroupClick && (
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
