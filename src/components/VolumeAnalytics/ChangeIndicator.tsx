/**
 * Shared component for displaying percentage change with up/down arrows.
 *
 * Part of AMA-483: Volume Analytics Dashboard
 */

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface ChangeIndicatorProps {
  change: number | null;
  className?: string;
}

export function ChangeIndicator({ change, className = '' }: ChangeIndicatorProps) {
  if (change === null) {
    return (
      <span
        className={`flex items-center text-muted-foreground ${className}`}
        data-testid="change-indicator"
      >
        <Minus className="w-3 h-3" />
      </span>
    );
  }

  const isPositive = change > 0;
  const isNegative = change < 0;
  const absChange = Math.abs(change);

  return (
    <span
      className={`flex items-center gap-1 text-xs ${
        isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-muted-foreground'
      } ${className}`}
      data-testid="change-indicator"
    >
      {isPositive && <ArrowUp className="w-3 h-3" />}
      {isNegative && <ArrowDown className="w-3 h-3" />}
      {!isPositive && !isNegative && <Minus className="w-3 h-3" />}
      {absChange > 0 ? `${absChange.toFixed(0)}%` : '-'}
    </span>
  );
}
