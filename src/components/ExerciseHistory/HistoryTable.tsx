/**
 * Table displaying exercise session history with expandable set details.
 *
 * Part of AMA-481: Build Exercise History Page with 1RM Trends
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Trophy, TrendingUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import type { Session, SetDetail } from '../../hooks/useProgressionApi';

interface HistoryTableProps {
  sessions: Session[];
  isLoading?: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatWeight(weight: number | null, unit: string): string {
  if (weight === null) return '-';
  return `${weight} ${unit}`;
}

function formatReps(reps: number | null): string {
  if (reps === null) return '-';
  return `${reps}`;
}

function SetRow({ set, weightUnit, sessionId }: { set: SetDetail; weightUnit: string; sessionId: string }) {
  return (
    <TableRow className="bg-muted/30" data-testid={`set-row-${sessionId}-${set.setNumber}`}>
      <TableCell className="pl-12">Set {set.setNumber}</TableCell>
      <TableCell>{formatWeight(set.weight, weightUnit)}</TableCell>
      <TableCell>{formatReps(set.repsCompleted)}</TableCell>
      <TableCell>
        {set.estimated1Rm ? (
          <span className="flex items-center gap-1">
            {Math.round(set.estimated1Rm)} {weightUnit}
            {set.isPr && (
              <Trophy className="w-3 h-3 text-amber-500" />
            )}
          </span>
        ) : (
          '-'
        )}
      </TableCell>
      <TableCell>
        {set.isPr && (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            PR
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

function SessionRow({ session }: { session: Session }) {
  const [expanded, setExpanded] = useState(false);
  const weightUnit = session.sets[0]?.weightUnit || 'lbs';
  const hasPr = session.sets.some((s) => s.isPr);

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
        data-testid={`session-row-${session.completionId}`}
      >
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            aria-label={expanded ? 'Collapse session details' : 'Expand session details'}
            aria-expanded={expanded}
            data-testid={`session-expand-${session.completionId}`}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className="font-medium">{formatDate(session.workoutDate)}</TableCell>
        <TableCell className="max-w-[200px] truncate">
          {session.workoutName || 'Untitled Workout'}
        </TableCell>
        <TableCell>{session.sets.length}</TableCell>
        <TableCell>
          {session.sessionMaxWeight
            ? formatWeight(session.sessionMaxWeight, weightUnit)
            : '-'}
        </TableCell>
        <TableCell>
          {session.sessionBest1Rm ? (
            <span className="flex items-center gap-1">
              {Math.round(session.sessionBest1Rm)} {weightUnit}
              {hasPr && <Trophy className="w-3 h-3 text-amber-500" />}
            </span>
          ) : (
            '-'
          )}
        </TableCell>
        <TableCell>
          {session.sessionTotalVolume
            ? `${session.sessionTotalVolume.toLocaleString()} ${weightUnit}`
            : '-'}
        </TableCell>
      </TableRow>
      {expanded && session.sets.map((set) => (
        <SetRow key={set.setNumber} set={set} weightUnit={weightUnit} sessionId={session.completionId} />
      ))}
    </>
  );
}

function LoadingSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i} data-testid={i === 0 ? 'history-table-loading' : undefined}>
          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function HistoryTable({ sessions, isLoading }: HistoryTableProps) {
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Workout</TableHead>
            <TableHead>Sets</TableHead>
            <TableHead>Max Weight</TableHead>
            <TableHead>Best 1RM</TableHead>
            <TableHead>Volume</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <LoadingSkeleton />
        </TableBody>
      </Table>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12" data-testid="history-table-empty">
        <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">No sessions in this date range</p>
      </div>
    );
  }

  return (
    <Table data-testid="history-table">
      <TableHeader>
        <TableRow>
          <TableHead className="w-8"></TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Workout</TableHead>
          <TableHead>Sets</TableHead>
          <TableHead>Max Weight</TableHead>
          <TableHead>Best 1RM</TableHead>
          <TableHead>Volume</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => (
          <SessionRow key={session.completionId} session={session} />
        ))}
      </TableBody>
    </Table>
  );
}
