import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { SchedulingConflict } from './types';

interface ConflictIndicatorProps {
  /** Conflicts affecting this day */
  conflicts: SchedulingConflict[];
  /** Called when the indicator is clicked to show details */
  onClick?: () => void;
}

/**
 * AMA-1118: Warning triangle icon shown on day columns with conflicts.
 *
 * - Yellow triangle for warnings
 * - Red shield for critical conflicts
 * - Badge count when multiple conflicts exist
 */
export function ConflictIndicator({ conflicts, onClick }: ConflictIndicatorProps) {
  if (conflicts.length === 0) return null;

  const hasCritical = conflicts.some(c => c.severity === 'critical');
  const count = conflicts.length;

  return (
    <button
      data-testid="conflict-indicator"
      onClick={onClick}
      className={`
        relative inline-flex items-center justify-center rounded-md p-1
        transition-colors hover:bg-accent
        ${hasCritical ? 'text-red-400' : 'text-yellow-400'}
      `}
      aria-label={`${count} conflict${count > 1 ? 's' : ''} detected`}
      title={`${count} conflict${count > 1 ? 's' : ''} detected`}
    >
      {hasCritical ? (
        <ShieldAlert className="h-4 w-4" data-testid="conflict-icon-critical" />
      ) : (
        <AlertTriangle className="h-4 w-4" data-testid="conflict-icon-warning" />
      )}
      {count > 1 && (
        <span
          data-testid="conflict-count-badge"
          className={`
            absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center
            rounded-full text-[10px] font-bold leading-none text-white
            ${hasCritical ? 'bg-red-500' : 'bg-yellow-500'}
          `}
        >
          {count}
        </span>
      )}
    </button>
  );
}
