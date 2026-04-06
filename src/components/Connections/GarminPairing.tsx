import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Watch, ExternalLink, Loader2 } from 'lucide-react';

interface GarminPairingProps {
  isPaired?: boolean;
  deviceName?: string;
}

export function GarminPairing({ isPaired = false, deviceName }: GarminPairingProps) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateCode = async () => {
    setLoading(true);
    try {
      const { authenticatedFetch } = await import('../../lib/authenticated-fetch');
      const { API_URLS } = await import('../../lib/config');
      const resp = await authenticatedFetch(`${API_URLS.MAPPER}/mobile/pairing/generate`, {
        method: 'POST',
      });
      if (resp.ok) {
        const data = await resp.json();
        setPairingCode(data.short_code || data.token?.slice(0, 6) || '------');
      }
    } catch {
      setPairingCode('------');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Watch className="w-5 h-5 text-orange-500" />
            Garmin
          </CardTitle>
          <Badge variant={isPaired ? 'default' : 'secondary'} className={isPaired ? 'bg-green-500' : ''}>
            {isPaired ? 'Paired' : 'Not paired'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPaired ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Paired with <strong>{deviceName || 'Garmin Watch'}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Workouts are delivered as native FIT files. Open the AmakaFlow widget on your watch to browse and download.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your Garmin watch to receive workouts directly. Workouts launch in Garmin's native strength and running apps.
            </p>

            {pairingCode ? (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground mb-2">Enter this code on your Garmin watch:</p>
                <div className="text-3xl font-mono font-bold tracking-[0.3em] text-primary">
                  {pairingCode}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Open the AmakaFlow widget on your watch and enter this code
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium">How to connect:</p>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Install the AmakaFlow widget from Garmin Connect IQ Store</li>
                  <li>Open the widget on your Garmin watch</li>
                  <li>Click "Generate Code" below, then enter it on your watch</li>
                </ol>
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" className="gap-2" onClick={generateCode} disabled={loading}>
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Watch className="w-3.5 h-3.5" />}
                {pairingCode ? 'New Code' : 'Generate Code'}
              </Button>
              <Button size="sm" variant="outline" className="gap-2" asChild>
                <a href="https://apps.garmin.com" target="_blank" rel="noopener noreferrer">
                  Install Widget
                  <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
