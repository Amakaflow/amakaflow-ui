/**
 * ComparisonChart — bar chart comparing shoes across Stryd metrics (AMA-1112).
 * Uses Recharts (already in project dependencies).
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import type { ShoeStats } from './hooks/useShoeComparison';

interface ComparisonChartProps {
  shoes: ShoeStats[];
}

// Colors for each shoe (up to 3)
const COLORS = ['#6366f1', '#f59e0b', '#10b981'];

interface ChartRow {
  metric: string;
  [shoeName: string]: string | number;
}

function buildChartData(shoes: ShoeStats[]): ChartRow[] {
  return [
    {
      metric: 'Power (W)',
      ...Object.fromEntries(shoes.map((s) => [s.shoe_name, s.avg_power])),
    },
    {
      metric: 'Form Power (W)',
      ...Object.fromEntries(shoes.map((s) => [s.shoe_name, s.avg_form_power])),
    },
    {
      metric: 'Leg Spring (kN/m)',
      ...Object.fromEntries(shoes.map((s) => [s.shoe_name, s.avg_leg_spring_stiffness])),
    },
    {
      metric: 'Vert Osc (cm)',
      ...Object.fromEntries(shoes.map((s) => [s.shoe_name, s.avg_vertical_oscillation])),
    },
    {
      metric: 'Avg HR (bpm)',
      ...Object.fromEntries(shoes.map((s) => [s.shoe_name, s.avg_hr])),
    },
  ];
}

export function ComparisonChart({ shoes }: ComparisonChartProps) {
  const data = buildChartData(shoes);

  return (
    <Card data-testid="comparison-chart">
      <CardHeader>
        <CardTitle className="text-lg">Metric Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="metric"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--card-foreground))',
              }}
            />
            <Legend />
            {shoes.map((shoe, i) => (
              <Bar
                key={shoe.shoe_name}
                dataKey={shoe.shoe_name}
                fill={COLORS[i % COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
