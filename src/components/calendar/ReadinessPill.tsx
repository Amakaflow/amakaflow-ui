import type { ReadinessTier } from './types';

interface ReadinessPillProps {
  score: number;
  tier: ReadinessTier;
}

const tierStyles: Record<ReadinessTier, string> = {
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  amber: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function ReadinessPill({ score, tier }: ReadinessPillProps) {
  return (
    <span
      data-testid="readiness-pill"
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${tierStyles[tier]}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${
        tier === 'green' ? 'bg-green-400' : tier === 'amber' ? 'bg-yellow-400' : 'bg-red-400'
      }`} />
      {score}
    </span>
  );
}
