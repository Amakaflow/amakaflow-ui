/**
 * Compact Personal Records widget for dashboard embedding.
 *
 * Part of AMA-482: Create Personal Records (PRs) Component
 *
 * Displays top PRs in a compact card format suitable for dashboards,
 * with a "View All" button for navigation to the full list.
 */

import { KeyboardEvent } from 'react';
import { Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { usePersonalRecords } from '../../hooks/useProgressionApi';
import { isRecentPR, formatDate } from './PRCard';
import { RECORD_TYPE_LABELS_COMPACT } from './constants';
import type { PersonalRecord } from '../../types/progression';

interface PRSummaryProps {
  maxRecords?: number;
  onViewAll?: () => void;
  onRecordClick?: (exerciseId: string) => void;
}

function CompactPRItem({
  record,
  onClick,
}: {
  record: PersonalRecord;
  onClick?: () => void;
}) {
  const isRecent = isRecentPR(record.achievedAt);
  const isClickable = !!onClick;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={`flex items-center justify-between py-2 ${isClickable ? 'cursor-pointer hover:bg-accent/30 -mx-2 px-2 rounded' : ''}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      data-testid="pr-summary-item"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate" data-testid="pr-summary-exercise">
            {record.exerciseName}
          </span>
          {isRecent && (
            <Badge variant="default" className="text-xs px-1.5 py-0" data-testid="pr-summary-new-badge">
              New!
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDate(record.achievedAt)}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <span className="text-sm font-bold" data-testid="pr-summary-value">
          {record.value} {record.unit}
        </span>
        <Badge variant="secondary" className="text-xs" data-testid="pr-summary-type">
          {RECORD_TYPE_LABELS_COMPACT[record.recordType]}
        </Badge>
      </div>
    </div>
  );
}

function LoadingSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2" data-testid="pr-summary-loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <div>
            <Skeleton className="h-4 w-28 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center" data-testid="pr-summary-empty">
      <Trophy className="w-8 h-8 text-muted-foreground mb-2" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        No personal records yet.
        <br />
        Start lifting to set your first PR!
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-sm text-destructive py-4" data-testid="pr-summary-error">
      Failed to load records: {message}
    </div>
  );
}

export function PRSummary({
  maxRecords = 5,
  onViewAll,
  onRecordClick,
}: PRSummaryProps) {
  const { data, isLoading, error } = usePersonalRecords({
    limit: maxRecords,
  });

  const records = data?.records ?? [];

  return (
    <Card data-testid="pr-summary">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="w-5 h-5 text-amber-500" aria-hidden="true" />
          Personal Records
        </CardTitle>
        {onViewAll && records.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            data-testid="pr-summary-view-all"
          >
            View All
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton count={Math.min(maxRecords, 3)} />
        ) : error ? (
          <ErrorState message={error.message} />
        ) : records.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y" data-testid="pr-summary-list">
            {records.slice(0, maxRecords).map((record) => (
              <CompactPRItem
                key={`${record.exerciseId}-${record.recordType}`}
                record={record}
                onClick={onRecordClick ? () => onRecordClick(record.exerciseId) : undefined}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
