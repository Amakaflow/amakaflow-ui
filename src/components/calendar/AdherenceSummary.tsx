import { Check, Target } from 'lucide-react';

interface AdherenceSummaryProps {
  completed: number;
  total: number;
}

export function AdherenceSummary({ completed, total }: AdherenceSummaryProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div
      data-testid="adherence-summary"
      className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-2.5"
    >
      <div className="flex items-center gap-1.5">
        <Target className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Week Adherence</span>
      </div>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-1 text-sm font-semibold text-foreground tabular-nums">
        <Check className="h-4 w-4 text-green-400" />
        {completed}/{total} sessions
      </div>
    </div>
  );
}
