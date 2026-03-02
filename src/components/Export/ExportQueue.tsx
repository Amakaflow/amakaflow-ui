import { CheckCircle2, Loader2, XCircle, Clock, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { ExportQueueItem } from '../../hooks/useExportFlow';

interface ExportQueueProps {
  queue: ExportQueueItem[];
  onRemove: (workoutId: string) => void;
}

const STATUS_ICONS = {
  pending: { Icon: Clock, className: 'text-muted-foreground' },
  exporting: { Icon: Loader2, className: 'text-blue-500 animate-spin' },
  done: { Icon: CheckCircle2, className: 'text-green-500' },
  error: { Icon: XCircle, className: 'text-red-500' },
} as const;

export function ExportQueue({ queue, onRemove }: ExportQueueProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Queue</CardTitle>
          <Badge variant="outline">{queue.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No workouts queued
          </p>
        ) : (
          queue.map(item => {
            const { Icon, className } = STATUS_ICONS[item.status];
            return (
              <div
                key={item.workoutId}
                data-testid={`export-queue-item-${item.workoutId}`}
                className="flex items-center gap-2 p-2 rounded-md border"
              >
                <Icon className={`w-4 h-4 shrink-0 ${className}`} />
                <span className="flex-1 text-sm truncate">{item.workout.title}</span>
                {item.error && (
                  <span className="text-xs text-red-500 truncate max-w-20" title={item.error}>
                    {item.error}
                  </span>
                )}
                {item.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => onRemove(item.workoutId)}
                    aria-label="Remove from queue"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
