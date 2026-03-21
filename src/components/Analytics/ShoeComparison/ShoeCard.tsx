/**
 * ShoeCard — per-shoe card showing key metrics and "Best for" badges (AMA-1112).
 */

import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import type { ShoeStats } from './hooks/useShoeComparison';

function formatPace(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}/km`;
}

interface ShoeCardProps {
  shoe: ShoeStats;
}

export function ShoeCard({ shoe }: ShoeCardProps) {
  return (
    <Card data-testid={`shoe-card-${shoe.shoe_name.replace(/\s+/g, '-').toLowerCase()}`}>
      <CardHeader>
        <CardTitle className="text-lg">{shoe.shoe_name}</CardTitle>
        <div className="flex flex-wrap gap-1 mt-1">
          {shoe.best_for.map((tag) => (
            <Badge key={tag} variant="secondary" data-testid="best-for-badge">
              Best for: {tag}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <Metric label="Runs" value={shoe.total_runs.toString()} />
          <Metric label="Total km" value={shoe.total_km.toFixed(1)} />
          <Metric label="Avg pace" value={formatPace(shoe.avg_pace_per_km)} />
          <Metric label="Avg power" value={`${shoe.avg_power}W`} />
          <Metric label="Form power" value={`${shoe.avg_form_power}W`} />
          <Metric label="Leg spring" value={`${shoe.avg_leg_spring_stiffness} kN/m`} />
          <Metric label="Vert osc" value={`${shoe.avg_vertical_oscillation} cm`} />
          <Metric label="Avg HR" value={`${shoe.avg_hr} bpm`} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  );
}
