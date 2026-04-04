import { useRef } from 'react';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { initiateStravaOAuth } from '../../api/clients/strava';
import { toast } from 'sonner';

interface IntegrationsTabProps {
  onNavigate?: (view: string) => void;
}

export function IntegrationsTab({ onNavigate }: IntegrationsTabProps) {
  const fitInputRef = useRef<HTMLInputElement>(null);

  const handleStravaClick = async () => {
    try {
      const url = await initiateStravaOAuth();
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect to Strava');
    }
  };

  const handleFitFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    toast.info(`${files.length} file${files.length > 1 ? 's' : ''} selected — import coming in next update`);
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleGarminClick = () => {
    if (onNavigate) {
      onNavigate('connections');
    } else {
      toast.info('Connect Garmin in Settings > Connections');
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Connect external tools and services. Imported workouts flow into the same results screen.
      </p>

      {/* Strava — OAuth ready */}
      <Card
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => { void handleStravaClick(); }}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void handleStravaClick(); } }}
      >
        <CardContent className="flex items-center gap-4 p-4">
          <span className="text-2xl" role="img" aria-label="Strava">🚴</span>
          <div className="flex-1">
            <p className="font-medium text-sm">Strava</p>
            <p className="text-xs text-muted-foreground">Pull activities from your Strava account</p>
          </div>
          <Badge variant="outline">Connect</Badge>
        </CardContent>
      </Card>

      {/* FIT / TCX files — file picker */}
      <Card
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => fitInputRef.current?.click()}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fitInputRef.current?.click(); } }}
      >
        <CardContent className="flex items-center gap-4 p-4">
          <span className="text-2xl" role="img" aria-label="FIT/TCX files">📁</span>
          <div className="flex-1">
            <p className="font-medium text-sm">FIT / TCX files</p>
            <p className="text-xs text-muted-foreground">Upload Garmin or device export files (.fit, .tcx, .gpx)</p>
          </div>
          <Badge variant="outline">Upload</Badge>
        </CardContent>
      </Card>
      <input
        ref={fitInputRef}
        type="file"
        accept=".fit,.tcx,.gpx"
        multiple
        className="hidden"
        onChange={handleFitFileChange}
      />

      {/* Garmin Connect — link to Settings > Connections */}
      <Card
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={handleGarminClick}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleGarminClick(); } }}
      >
        <CardContent className="flex items-center gap-4 p-4">
          <span className="text-2xl" role="img" aria-label="Garmin Connect">⌚</span>
          <div className="flex-1">
            <p className="font-medium text-sm">Garmin Connect</p>
            <p className="text-xs text-muted-foreground">Import from Garmin workout library</p>
          </div>
          <Badge variant="outline">Settings &rsaquo; Connections</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
