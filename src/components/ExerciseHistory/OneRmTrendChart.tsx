/**
 * Line chart showing 1RM trend over time.
 *
 * Part of AMA-481: Build Exercise History Page with 1RM Trends
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import type { Session } from '../../hooks/useProgressionApi';

interface OneRmTrendChartProps {
  sessions: Session[];
  allTimeBest1Rm: number | null;
  isLoading?: boolean;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  estimated1Rm: number;
  workoutName: string;
  isPr: boolean;
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

interface TooltipPayload {
  payload: ChartDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function prepareChartData(sessions: Session[]): ChartDataPoint[] {
  // Reverse to show oldest first (left to right chronologically)
  const reversed = [...sessions].reverse();

  return reversed
    .filter((session) => session.sessionBest1Rm !== null)
    .map((session) => ({
      date: session.workoutDate,
      displayDate: formatDateShort(session.workoutDate),
      estimated1Rm: Math.round(session.sessionBest1Rm!),
      workoutName: session.workoutName || 'Workout',
      isPr: session.sets.some((s) => s.isPr),
    }));
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium">{formatDateLong(data.date)}</p>
      <p className="text-muted-foreground">{data.workoutName}</p>
      <p className="mt-1">
        <span className="font-semibold">{data.estimated1Rm}</span>{' '}
        <span className="text-muted-foreground">lbs estimated 1RM</span>
      </p>
      {data.isPr && (
        <p className="text-amber-600 font-medium mt-1">Personal Record!</p>
      )}
    </div>
  );
}

export function OneRmTrendChart({
  sessions,
  allTimeBest1Rm,
  isLoading,
}: OneRmTrendChartProps) {
  if (isLoading) {
    return (
      <Card data-testid="1rm-trend-chart">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="1rm-trend-chart-title">
            <TrendingUp className="w-5 h-5" />
            1RM Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" data-testid="1rm-trend-loading" />
        </CardContent>
      </Card>
    );
  }

  const chartData = prepareChartData(sessions);

  if (chartData.length === 0) {
    return (
      <Card data-testid="1rm-trend-chart">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="1rm-trend-chart-title">
            <TrendingUp className="w-5 h-5" />
            1RM Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground" data-testid="1rm-trend-empty">
            No 1RM data available for this date range
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate min/max for better Y-axis scaling
  const values = chartData.map((d) => d.estimated1Rm);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = Math.max(10, (maxValue - minValue) * 0.1);
  const yMin = Math.max(0, Math.floor((minValue - padding) / 5) * 5);
  const yMax = Math.ceil((maxValue + padding) / 5) * 5;

  return (
    <Card data-testid="1rm-trend-chart">
      <CardHeader>
        <CardTitle className="flex items-center gap-2" data-testid="1rm-trend-chart-title">
          <TrendingUp className="w-5 h-5" />
          1RM Trend
          {allTimeBest1Rm && (
            <span className="text-sm font-normal text-muted-foreground ml-auto" data-testid="1rm-trend-all-time-best">
              All-time best: {Math.round(allTimeBest1Rm)} lbs
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            {allTimeBest1Rm && (
              <ReferenceLine
                y={Math.round(allTimeBest1Rm)}
                stroke="#f59e0b"
                strokeDasharray="5 5"
                label={{
                  value: 'PR',
                  position: 'right',
                  fill: '#f59e0b',
                  fontSize: 11,
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="estimated1Rm"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={{ fill: '#0ea5e9', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
