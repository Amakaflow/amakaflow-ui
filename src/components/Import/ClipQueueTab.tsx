import { Button } from '../ui/button';
import { Bookmark } from 'lucide-react';

export function ClipQueueTab() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Bookmark className="w-6 h-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">Clip workouts as you browse</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Install the browser extension to save workouts with one click from any website.
          Clips will appear here ready to import.
        </p>
      </div>
      <Button disabled variant="outline">
        Get the extension — coming soon
      </Button>
    </div>
  );
}
