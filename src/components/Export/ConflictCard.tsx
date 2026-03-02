import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import type { ConflictItem } from '../../hooks/useExportFlow';

interface ConflictCardProps {
  conflict: ConflictItem;
  onShowPreview: () => void;
}

export function ConflictCard({ conflict, onShowPreview }: ConflictCardProps) {
  return (
    <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
      <AlertTriangle className="h-4 w-4 text-orange-500" />
      <AlertDescription className="space-y-2">
        <div>
          <p className="font-medium text-sm">
            <span className="font-bold">{conflict.blockLabel}</span> — {conflict.description}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{conflict.deviceWarning}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onShowPreview}
          className="h-7 text-xs"
        >
          Preview on device
        </Button>
      </AlertDescription>
    </Alert>
  );
}
