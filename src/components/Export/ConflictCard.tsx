import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { ConflictItem } from '../../hooks/useExportFlow';

interface ConflictCardProps {
  conflict: ConflictItem;
}

export function ConflictCard({ conflict }: ConflictCardProps) {
  return (
    <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
      <AlertTriangle className="h-4 w-4 text-orange-500" />
      <AlertDescription className="space-y-2">
        <div>
          {conflict.workoutTitle && (
            <p className="text-xs text-muted-foreground mb-1">
              <Badge variant="secondary" className="text-xs font-normal">{conflict.workoutTitle}</Badge>
            </p>
          )}
          <p className="font-medium text-sm">
            <span className="font-bold">{conflict.blockLabel}</span>
            {' '}
            <Badge variant="outline" className="text-xs align-middle">{conflict.structure}</Badge>
            {' '}— {conflict.description}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{conflict.deviceWarning}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {}}
            className="h-7 text-xs"
            title="Preview functionality coming soon"
            aria-label="Show me a preview of how this block will be exported"
          >
            Show me
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {}}
            className="h-7 text-xs"
            title="Export will proceed despite the warning"
            aria-label="Export this block anyway despite the structural warning"
          >
            Export anyway
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
