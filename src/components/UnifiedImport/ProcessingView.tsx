import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { ProcessedItem, QueueItem } from '../../types/unified-import';

interface ProcessingViewProps {
  queueItems: QueueItem[];
  processedItems: ProcessedItem[];
  onRetry: (queueId: string) => void;
}

function StatusBadge({ status }: { status: ProcessedItem['status'] }) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="w-3 h-3" />
          Pending
        </Badge>
      );
    case 'detecting':
    case 'extracting':
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing
        </Badge>
      );
    case 'done':
      return (
        <Badge className="gap-1 bg-green-600 text-white hover:bg-green-600">
          <CheckCircle className="w-3 h-3" />
          Done
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" />
          Failed
        </Badge>
      );
  }
}

export function ProcessingView({ queueItems, processedItems, onRetry }: ProcessingViewProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">
        Processing {queueItems.length} item{queueItems.length !== 1 ? 's' : ''}…
      </p>
      {queueItems.map(item => {
        const processed = processedItems.find(p => p.queueId === item.id);
        const status = processed?.status ?? 'pending';
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 rounded-md border bg-muted/20"
          >
            <span className="flex-1 text-sm truncate">{item.label}</span>
            <StatusBadge status={status} />
            {status === 'failed' && (
              <Button variant="ghost" size="sm" onClick={() => onRetry(item.id)}>
                Retry
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
