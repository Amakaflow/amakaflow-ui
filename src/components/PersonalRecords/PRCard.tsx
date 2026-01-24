/**
 * Individual Personal Record display card.
 *
 * Part of AMA-482: Create Personal Records (PRs) Component
 *
 * Displays a single PR with exercise name, value, record type badge,
 * date achieved, and "New PR" indicator for recent records.
 */

import { KeyboardEvent } from 'react';
import { Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { RECORD_TYPE_LABELS } from './constants';
import type { PersonalRecord } from '../../types/progression';

interface PRCardProps {
  record: PersonalRecord;
  isRecent?: boolean;
  onClick?: () => void;
}

/**
 * Checks if a PR was achieved within the last 7 days.
 */
export function isRecentPR(achievedAt: string | null): boolean {
  if (!achievedAt) return false;
  const date = new Date(achievedAt);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return date >= sevenDaysAgo;
}

/**
 * Formats a date string for display.
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats a PR value with its unit.
 */
function formatValue(value: number, unit: string): string {
  return `${value} ${unit}`;
}

export function PRCard({ record, isRecent, onClick }: PRCardProps) {
  const showNewPRBadge = isRecent ?? isRecentPR(record.achievedAt);
  const isClickable = !!onClick;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <Card
      className={isClickable ? 'cursor-pointer hover:bg-accent/50 transition-colors' : undefined}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      data-testid="pr-card"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium" data-testid="pr-exercise-name">
          {record.exerciseName}
        </CardTitle>
        <Trophy className="w-4 h-4 text-amber-500" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid="pr-value">
          {formatValue(record.value, record.unit)}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="secondary" data-testid="pr-type-badge">
            {RECORD_TYPE_LABELS[record.recordType]}
          </Badge>
          {showNewPRBadge && (
            <Badge variant="default" data-testid="pr-new-badge">
              New PR!
            </Badge>
          )}
          <span className="text-xs text-muted-foreground" data-testid="pr-date">
            {formatDate(record.achievedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
