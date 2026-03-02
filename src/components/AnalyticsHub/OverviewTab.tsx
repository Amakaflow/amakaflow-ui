// src/components/AnalyticsHub/OverviewTab.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { TrendingUp, Flame, Clock, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  computeWeeklyHours,
  computeWeeklySessionCount,
  computeMonthlyHours,
  computeStreak,
  computeTrainingSplit,
  computeAverageWorkoutDuration,
  computeWeeklyDelta,
  computeWeeklyChartData,
  formatHours,
} from '../../lib/analytics-stats';
import type { AppUser } from '../../app/useAppAuth';
import type { WorkoutHistoryItem } from '../../lib/workout-history';

interface OverviewTabProps {
  /** Reserved for future personalisation (units, locale). Not yet consumed. */
  user: AppUser;
  history: WorkoutHistoryItem[];
}

export function OverviewTab({ history }: OverviewTabProps) {
  const [chartMode, setChartMode] = useState<'sessions' | 'hours'>('sessions');

  const weeklyHours = computeWeeklyHours(history);
  const sessionsThisWeek = computeWeeklySessionCount(history);
  const streak = computeStreak(history);
  const delta = computeWeeklyDelta(history);
  const { strengthMinutes, cardioMinutes } = computeTrainingSplit(history);
  const totalSplitMins = strengthMinutes + cardioMinutes || 1;
  const avgDuration = computeAverageWorkoutDuration(history);
  const monthlyHours = computeMonthlyHours(history);
  const chartData = computeWeeklyChartData(history);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">This week</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="stat-weekly-hours" aria-label={`This week: ${formatHours(weeklyHours)} training`}>
              {formatHours(weeklyHours)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">training</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Sessions</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="stat-sessions" aria-label={`${sessionsThisWeek} sessions in the last 7 days`}>
              {sessionsThisWeek}
            </div>
            <p className="text-xs text-muted-foreground mt-1">last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Streak</CardTitle>
            <Flame className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="stat-streak" aria-label={`${streak}-day streak`}>
              {streak}d
            </div>
            <p className="text-xs text-muted-foreground mt-1">consecutive days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">vs last week</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold ${delta > 0 ? 'text-green-600 dark:text-green-400' : delta < 0 ? 'text-red-500' : ''}`}
              data-testid="stat-delta"
              aria-label={delta === 0 ? 'Same as last week' : `${delta > 0 ? '+' : ''}${formatHours(Math.abs(delta))} compared to last week`}
            >
              {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${formatHours(Math.abs(delta))}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">vs last week</p>
          </CardContent>
        </Card>
      </div>

      {/* Training split */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Training split{' '}
            <span className="text-xs text-muted-foreground font-normal ml-1">4-week avg</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Strength</span>
              <span className="text-muted-foreground">{formatHours(strengthMinutes / 60)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${(strengthMinutes / totalSplitMins) * 100}%` }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Cardio</span>
              <span className="text-muted-foreground">{formatHours(cardioMinutes / 60)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${(cardioMinutes / totalSplitMins) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly activity chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Weekly activity</CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={chartMode === 'sessions' ? 'default' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => setChartMode('sessions')}
            >
              Sessions
            </Button>
            <Button
              size="sm"
              variant={chartMode === 'hours' ? 'default' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => setChartMode('hours')}
            >
              Hours
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={chartMode === 'hours'} />
              <Tooltip formatter={(v: number) => chartMode === 'hours' ? `${v}h` : v} />
              <Bar dataKey={chartMode} fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Averages */}
      <div className="grid gap-4 grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg workout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{Math.round(avgDuration)}m</div>
            <p className="text-xs text-muted-foreground mt-1">estimated duration</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatHours(monthlyHours)}</div>
            <p className="text-xs text-muted-foreground mt-1">training this month</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
