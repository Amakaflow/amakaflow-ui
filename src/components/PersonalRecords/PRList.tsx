/**
 * Scrollable list of Personal Records with filtering.
 *
 * Part of AMA-482: Create Personal Records (PRs) Component
 *
 * Displays a filterable list of PRs with loading, error, and empty states.
 */

import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent, CardHeader } from '../ui/card';
import { PRCard } from './PRCard';
import { RecordTypeFilter, type RecordTypeFilterValue } from './RecordTypeFilter';
import { usePersonalRecords } from '../../hooks/useProgressionApi';
import type { RecordType } from '../../types/progression';

interface PRListProps {
  exerciseId?: string;
  limit?: number;
  showFilter?: boolean;
  onRecordClick?: (exerciseId: string) => void;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" data-testid="pr-list-loading">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24 mb-2" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="pr-list-empty">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Trophy className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No Personal Records Yet</h3>
      <p className="text-muted-foreground text-sm max-w-sm">
        Complete workouts with weight tracking to start setting personal records.
        Your PRs will appear here as you progress!
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-destructive/10 text-destructive rounded-lg p-4" data-testid="pr-list-error">
      Failed to load personal records: {message}
    </div>
  );
}

export function PRList({
  exerciseId,
  limit,
  showFilter = true,
  onRecordClick,
}: PRListProps) {
  const [filter, setFilter] = useState<RecordTypeFilterValue>('all');

  const { data, isLoading, error } = usePersonalRecords({
    exerciseId,
    recordType: filter === 'all' ? undefined : (filter as RecordType),
    limit,
  });

  const records = data?.records ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {showFilter && <RecordTypeFilter value={filter} onChange={setFilter} />}
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        {showFilter && <RecordTypeFilter value={filter} onChange={setFilter} />}
        <ErrorState message={error.message} />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="pr-list">
      {showFilter && <RecordTypeFilter value={filter} onChange={setFilter} />}
      {records.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-3 pr-4">
            {records.map((record) => (
              <PRCard
                key={`${record.exerciseId}-${record.recordType}`}
                record={record}
                onClick={onRecordClick ? () => onRecordClick(record.exerciseId) : undefined}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
