import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Pencil, Trash2, FileText, Image, Link, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import type { ProcessedItem, QueueItem } from '../../types/import';

interface ResultsScreenProps {
  queueItems: QueueItem[];
  processedItems: ProcessedItem[];
  onSaveAll: () => void;
  onBuildOne: () => void;
  onEdit: (queueId: string) => void;
  onRemove: (queueId: string) => void;
}

function SourceIcon({ sourceIcon, type }: { sourceIcon?: ProcessedItem['sourceIcon']; type?: QueueItem['type'] }) {
  const resolved = sourceIcon ?? type;
  if (resolved === 'pdf') return <FileText className="w-5 h-5 text-muted-foreground" />;
  if (resolved === 'image') return <Image className="w-5 h-5 text-muted-foreground" />;
  return <Link className="w-5 h-5 text-muted-foreground" />;
}

export function ResultsScreen({
  queueItems,
  processedItems,
  onSaveAll,
  onBuildOne,
  onEdit,
  onRemove,
}: ResultsScreenProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const doneItems = processedItems.filter(p => p.status === 'done');
  const failedItems = processedItems.filter(p => p.status === 'failed' || p.status === 'error');

  return (
    <div className="space-y-6">
      {/* Primary actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          className="flex-1"
          onClick={onSaveAll}
          disabled={doneItems.length === 0}
        >
          Save all to library ({doneItems.length})
        </Button>
        {doneItems.length >= 2 && (
          <Button variant="outline" className="flex-1 gap-2" onClick={onBuildOne}>
            <Layers className="w-4 h-4" />
            Build one workout from these
          </Button>
        )}
      </div>

      {/* Result cards */}
      <div className="space-y-3">
        {doneItems.map(processed => {
          const qi = queueItems.find(q => q.id === processed.queueId);
          const isExpanded = expandedIds.has(processed.queueId);
          return (
            <Card key={processed.queueId}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <SourceIcon sourceIcon={processed.sourceIcon} type={qi?.type} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {processed.workoutTitle ?? 'Untitled workout'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {processed.blockCount ?? 0} blocks · {processed.exerciseCount ?? 0} exercises
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(processed.queueId)}
                      aria-label={isExpanded ? `Collapse ${processed.workoutTitle ?? 'workout'}` : `Expand ${processed.workoutTitle ?? 'workout'}`}
                    >
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => onEdit(processed.queueId)}
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(processed.queueId)}
                      aria-label="Remove"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t pt-3 mt-3 space-y-2">
                    {(processed.workout?.blocks ?? []).map((block: { id: string; label?: string; exercises?: Array<{ name: string; sets?: number; reps?: number | string; duration_sec?: number }> }, idx: number) => (
                      <div key={block.id ?? idx} className="text-sm px-2 py-1 rounded bg-muted/30">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{block.label ?? `Block ${idx + 1}`}</span>
                          {block.exercises?.length ? (
                            <span className="text-muted-foreground text-xs shrink-0">
                              {block.exercises.length} ex.
                            </span>
                          ) : null}
                        </div>
                        {block.exercises && block.exercises.length > 0 && (
                          <ul className="mt-1 space-y-0.5 pl-2">
                            {block.exercises.map((ex, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                                <span className="text-foreground">{ex.name}</span>
                                {ex.sets && ex.reps && <span>{ex.sets}×{ex.reps}</span>}
                                {ex.duration_sec && !ex.reps && <span>{ex.duration_sec}s</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                    {(!processed.workout?.blocks || processed.workout.blocks.length === 0) && (
                      <p className="text-xs text-muted-foreground italic px-2">No block details available</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Failed items */}
      {failedItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">
            {failedItems.length} item{failedItems.length !== 1 ? 's' : ''} failed
          </p>
          {failedItems.map(p => {
            const qi = queueItems.find(q => q.id === p.queueId);
            return (
              <div
                key={p.queueId}
                className="flex items-center gap-2 p-2 rounded border border-destructive/40 text-sm"
              >
                <span className="flex-1 truncate text-muted-foreground">{qi?.label}</span>
                <Badge variant="destructive">Failed</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
