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
          >
            Show me
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {}}
            className="h-7 text-xs"
          >
            Export anyway
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
