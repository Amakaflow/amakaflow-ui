import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../ui/card';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';

export function StravaCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const navigate = useNavigate();

  useEffect(() => {
    // The backend handles the actual OAuth exchange at /strava/oauth/callback.
    // The frontend redirect_uri points here so we can show the user a result.
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      setStatus('error');
    } else {
      setStatus('success');
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          {status === 'processing' && (
            <>
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p>Connecting to Strava...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle2 className="w-8 h-8 mx-auto text-green-500" />
              <p className="font-medium">Strava connected!</p>
              <p className="text-sm text-muted-foreground">
                Your activities will sync automatically.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/settings/connections')}
              >
                Back to Connections
              </Button>
            </>
          )}
          {status === 'error' && (
            <>
              <AlertTriangle className="w-8 h-8 mx-auto text-destructive" />
              <p className="font-medium">Connection failed</p>
              <p className="text-sm text-muted-foreground">
                Please try again from Settings &rarr; Connections.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/settings/connections')}
              >
                Back to Connections
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
