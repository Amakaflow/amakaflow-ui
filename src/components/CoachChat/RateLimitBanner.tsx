/**
 * RateLimitBanner — shows remaining coach messages for the month.
 *
 * Displays "X of Y free messages used" with a progress indicator.
 * Changes color as usage increases (green -> yellow -> red).
 */

import { cn } from '../ui/utils';
import type { RateLimitInfo } from './hooks/useCoachChat';

interface RateLimitBannerProps {
  info: RateLimitInfo;
}

export function RateLimitBanner({ info }: RateLimitBannerProps) {
  const remaining = info.limit - info.used;
  const pct = (info.used / info.limit) * 100;

  const barColor =
    pct >= 90
      ? 'bg-red-500'
      : pct >= 70
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  const textColor =
    pct >= 90
      ? 'text-red-400'
      : pct >= 70
        ? 'text-amber-400'
        : 'text-muted-foreground';

  return (
    <div
      data-testid="rate-limit-banner"
      className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 mx-3 mb-2"
    >
      {/* Progress bar */}
      <div className="h-1.5 flex-1 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {/* Label */}
      <span className={cn('text-xs whitespace-nowrap font-medium', textColor)}>
        {info.used} of {info.limit} free messages used
      </span>
    </div>
  );
}
