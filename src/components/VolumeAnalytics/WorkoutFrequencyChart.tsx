import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { WorkoutHistoryItem } from '../../lib/workout-history';

interface WorkoutFrequencyChartProps {
  history: WorkoutHistoryItem[];
}

function computeWeeklyFrequency(history: WorkoutHistoryItem[]): Array<{ week: string; sessions: number }> {
  return Array.from({ length: 8 }, (_, i) => {
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 7);

    const label = i === 0
      ? 'This wk'
      : weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const sessions = history.filter(item => {
      if (!item.createdAt) return false;
      const d = new Date(item.createdAt);
      return !isNaN(d.getTime()) && d >= weekStart && d < weekEnd;
    }).length;

    return { week: label, sessions };
  }).reverse();
}

export function WorkoutFrequencyChart({ history }: WorkoutFrequencyChartProps) {
  const data = computeWeeklyFrequency(history);

  return (
    <Card data-testid="frequency-chart">
      <CardHeader>
        <CardTitle className="text-base">
          Workout frequency{' '}
          <span className="text-xs text-muted-foreground font-normal ml-1">last 8 weeks</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(v: number) => [`${v} session${v !== 1 ? 's' : ''}`, '']} />
            <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
