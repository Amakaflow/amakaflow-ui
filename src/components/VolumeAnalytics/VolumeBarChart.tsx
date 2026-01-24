/**
 * Stacked bar chart showing volume by muscle group over time.
 *
 * Part of AMA-483: Volume Analytics Dashboard
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { getMuscleGroupDisplayName, getMuscleGroupColor, formatVolume } from './constants';
import type { VolumeDataPoint, VolumeGranularity } from '../../types/progression';

interface VolumeBarChartProps {
  data: VolumeDataPoint[];
  granularity: VolumeGranularity;
  isLoading?: boolean;
  onMuscleGroupClick?: (muscleGroup: string) => void;
}

interface ChartDataPoint {
  period: string;
  displayPeriod: string;
  [muscleGroup: string]: number | string;
}

function formatPeriod(period: string, granularity: VolumeGranularity): string {
  const date = new Date(period);

  switch (granularity) {
    case 'daily':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'weekly':
      return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    case 'monthly':
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    default:
      return period;
  }
}

function prepareChartData(data: VolumeDataPoint[], granularity: VolumeGranularity): {
  chartData: ChartDataPoint[];
  muscleGroups: string[];
} {
  // Group data by period
  const periodMap = new Map<string, Map<string, number>>();
  const allMuscleGroups = new Set<string>();

  data.forEach((point) => {
    if (!periodMap.has(point.period)) {
      periodMap.set(point.period, new Map());
    }
    const periodData = periodMap.get(point.period)!;
    periodData.set(point.muscleGroup, (periodData.get(point.muscleGroup) || 0) + point.totalVolume);
    allMuscleGroups.add(point.muscleGroup);
  });

  // Sort periods chronologically
  const sortedPeriods = Array.from(periodMap.keys()).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  // Convert to chart data format
  const chartData: ChartDataPoint[] = sortedPeriods.map((period) => {
    const periodData = periodMap.get(period)!;
    const dataPoint: ChartDataPoint = {
      period,
      displayPeriod: formatPeriod(period, granularity),
    };

    allMuscleGroups.forEach((muscleGroup) => {
      dataPoint[muscleGroup] = periodData.get(muscleGroup) || 0;
    });

    return dataPoint;
  });

  // Sort muscle groups by total volume (descending)
  const muscleGroupTotals = new Map<string, number>();
  data.forEach((point) => {
    muscleGroupTotals.set(
      point.muscleGroup,
      (muscleGroupTotals.get(point.muscleGroup) || 0) + point.totalVolume
    );
  });

  const muscleGroups = Array.from(allMuscleGroups).sort(
    (a, b) => (muscleGroupTotals.get(b) || 0) - (muscleGroupTotals.get(a) || 0)
  );

  return { chartData, muscleGroups };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const total = payload.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm max-w-xs">
      <p className="font-medium mb-2">{label}</p>
      <div className="space-y-1">
        {payload
          .filter((entry) => entry.value > 0)
          .sort((a, b) => b.value - a.value)
          .map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">
                  {getMuscleGroupDisplayName(entry.name)}
                </span>
              </div>
              <span className="font-medium">{formatVolume(entry.value)}</span>
            </div>
          ))}
      </div>
      <div className="border-t mt-2 pt-2">
        <div className="flex justify-between font-medium">
          <span>Total</span>
          <span>{formatVolume(total)} lbs</span>
        </div>
      </div>
    </div>
  );
}

export function VolumeBarChart({
  data,
  granularity,
  isLoading,
  onMuscleGroupClick,
}: VolumeBarChartProps) {
  if (isLoading) {
    return (
      <Card data-testid="volume-bar-chart">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="volume-bar-chart-title">
            <BarChart3 className="w-5 h-5" />
            Volume by Muscle Group
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" data-testid="volume-bar-chart-loading" />
        </CardContent>
      </Card>
    );
  }

  const { chartData, muscleGroups } = prepareChartData(data || [], granularity);

  if (chartData.length === 0) {
    return (
      <Card data-testid="volume-bar-chart">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="volume-bar-chart-title">
            <BarChart3 className="w-5 h-5" />
            Volume by Muscle Group
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="h-[300px] flex items-center justify-center text-muted-foreground"
            data-testid="volume-bar-chart-empty"
          >
            No volume data available for this period
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="volume-bar-chart">
      <CardHeader>
        <CardTitle className="flex items-center gap-2" data-testid="volume-bar-chart-title">
          <BarChart3 className="w-5 h-5" />
          Volume by Muscle Group
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="displayPeriod"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatVolume(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => getMuscleGroupDisplayName(value)}
              wrapperStyle={{ fontSize: '12px' }}
            />
            {muscleGroups.map((muscleGroup) => (
              <Bar
                key={muscleGroup}
                dataKey={muscleGroup}
                stackId="volume"
                fill={getMuscleGroupColor(muscleGroup)}
                cursor={onMuscleGroupClick ? 'pointer' : 'default'}
                onClick={
                  onMuscleGroupClick
                    ? () => onMuscleGroupClick(muscleGroup)
                    : undefined
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
