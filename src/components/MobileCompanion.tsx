import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import {
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowLeft,
  QrCode,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  generatePairingToken,
  checkPairingStatus,
  getPairedDevices,
  revokeDevice,
  GeneratePairingResponse,
  PairedDevice,
} from '../lib/mobile-api';

interface MobileCompanionProps {
  userId: string;
  onBack: () => void;
}

type PairingState = 'idle' | 'generating' | 'waiting' | 'paired' | 'expired' | 'error';

export function MobileCompanion({ userId, onBack }: MobileCompanionProps) {
  const [pairingState, setPairingState] = useState<PairingState>('idle');
  const [pairingData, setPairingData] = useState<GeneratePairingResponse | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paired devices state (AMA-184)
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);

  // Fetch paired devices on mount (AMA-184)
  const fetchPairedDevices = useCallback(async () => {
    try {
      setDevicesLoading(true);
      const devices = await getPairedDevices();
      setPairedDevices(devices);
    } catch (err) {
      console.error('Failed to fetch paired devices:', err);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPairedDevices();
  }, [fetchPairedDevices]);

  // Handle revoking a device (AMA-184)
  const handleRevokeDevice = async (deviceId: string) => {
    setRevokingDeviceId(deviceId);
    try {
      const result = await revokeDevice(deviceId);
      if (result.success) {
        setPairedDevices((prev) => prev.filter((d) => d.id !== deviceId));
        toast.success('Device access revoked');
      } else {
        toast.error(result.message || 'Failed to revoke device');
      }
    } catch (err: any) {
      console.error('Failed to revoke device:', err);
      toast.error(err.message || 'Failed to revoke device');
    } finally {
      setRevokingDeviceId(null);
    }
  };

  // Generate a new pairing token
  const handleGenerate = useCallback(async () => {
    setPairingState('generating');
    setError(null);

    try {
      const data = await generatePairingToken(userId);
      setPairingData(data);
      setPairingState('waiting');

      // Calculate time remaining
      const expiresAt = new Date(data.expiresAt).getTime();
      const now = Date.now();
      setTimeRemaining(Math.max(0, Math.floor((expiresAt - now) / 1000)));

      toast.success('Pairing code generated! Scan the QR code or enter the code on your iOS device.');
    } catch (err: any) {
      console.error('Failed to generate pairing token:', err);
      setError(err.message || 'Failed to generate pairing code');
      setPairingState('error');
      toast.error('Failed to generate pairing code');
    }
  }, [userId]);

  // Poll for pairing status
  useEffect(() => {
    if (pairingState !== 'waiting' || !pairingData) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await checkPairingStatus(pairingData.token);

        if (status.paired) {
          setPairingState('paired');
          clearInterval(pollInterval);
          toast.success('Device paired successfully!');
        } else if (status.expired) {
          setPairingState('expired');
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Error checking pairing status:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [pairingState, pairingData]);

  // Countdown timer
  useEffect(() => {
    if (pairingState !== 'waiting' || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setPairingState('expired');
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pairingState, timeRemaining]);

  // Copy short code to clipboard
  const handleCopy = async () => {
    if (!pairingData?.shortCode) return;

    try {
      await navigator.clipboard.writeText(pairingData.shortCode);
      setCopied(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  // Format time remaining as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date for display (AMA-184)
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Unknown';
    }
  };

  // Get device display name (AMA-184)
  const getDeviceDisplayName = (device: PairedDevice): string => {
    return device.deviceInfo?.device || 'Unknown Device';
  };

  // Get device OS info (AMA-184)
  const getDeviceOsInfo = (device: PairedDevice): string => {
    const os = device.deviceInfo?.os;
    const version = device.deviceInfo?.app_version;
    if (os && version) return `${os} • App v${version}`;
    if (os) return os;
    return '';
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">iOS Companion App</h1>
          <p className="text-muted-foreground text-sm">
            Connect your iPhone to sync workouts on the go
          </p>
        </div>
      </div>

      {/* Paired Devices Card (AMA-184) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Paired Devices
          </CardTitle>
          <CardDescription>
            iOS devices that can access your AmakaFlow account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devicesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : pairedDevices.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <Smartphone className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                No devices paired yet. Generate a pairing code below to connect your iPhone.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pairedDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{getDeviceDisplayName(device)}</p>
                      <p className="text-sm text-muted-foreground">
                        {getDeviceOsInfo(device)}
                        {getDeviceOsInfo(device) && ' • '}
                        Paired {formatDate(device.pairedAt)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevokeDevice(device.id)}
                    disabled={revokingDeviceId === device.id}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {revokingDeviceId === device.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    <span className="ml-2 hidden sm:inline">Revoke</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Pairing Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Pair Your Device
          </CardTitle>
          <CardDescription>
            Scan the QR code with the AmakaFlow iOS app or enter the pairing code manually
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Idle State - Show Generate Button */}
          {pairingState === 'idle' && (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <QrCode className="w-12 h-12 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">
                Generate a pairing code to connect your iOS device
              </p>
              <Button onClick={handleGenerate} size="lg">
                <QrCode className="w-4 h-4 mr-2" />
                Generate Pairing Code
              </Button>
            </div>
          )}

          {/* Generating State */}
          {pairingState === 'generating' && (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <RefreshCw className="w-12 h-12 text-muted-foreground animate-spin" />
              </div>
              <p className="text-muted-foreground">Generating pairing code...</p>
            </div>
          )}

          {/* Waiting State - Show QR Code and Short Code */}
          {pairingState === 'waiting' && pairingData && (
            <div className="space-y-6">
              {/* Timer */}
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Code expires in{' '}
                  <span className={timeRemaining < 60 ? 'text-orange-600 font-medium' : ''}>
                    {formatTime(timeRemaining)}
                  </span>
                </span>
              </div>

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg border">
                  <QRCodeSVG
                    value={pairingData.qrData}
                    size={200}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>

              <Separator />

              {/* Short Code */}
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Or enter this code manually in the app:
                </p>
                <div className="flex items-center justify-center gap-3">
                  <code className="text-3xl font-mono font-bold tracking-widest bg-muted px-6 py-3 rounded-lg">
                    {pairingData.shortCode}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    className="h-12 w-12"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Refresh Button */}
              <div className="flex justify-center">
                <Button variant="outline" onClick={handleGenerate} disabled={timeRemaining > 240}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate New Code
                </Button>
              </div>
            </div>
          )}

          {/* Paired State - Success */}
          {pairingState === 'paired' && (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Device Paired Successfully!</h3>
              <p className="text-muted-foreground mb-4">
                Your iOS device is now connected. You can use the app to view and sync workouts.
              </p>
              <Button variant="outline" onClick={() => setPairingState('idle')}>
                Pair Another Device
              </Button>
            </div>
          )}

          {/* Expired State */}
          {pairingState === 'expired' && (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                <Clock className="w-12 h-12 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Code Expired</h3>
              <p className="text-muted-foreground mb-4">
                The pairing code has expired. Generate a new one to continue.
              </p>
              <Button onClick={handleGenerate}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Generate New Code
              </Button>
            </div>
          )}

          {/* Error State */}
          {pairingState === 'error' && (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <AlertCircle className="w-12 h-12 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Something Went Wrong</h3>
              <p className="text-muted-foreground mb-2">{error || 'Failed to generate pairing code'}</p>
              <p className="text-sm text-muted-foreground mb-4">
                Please check your connection and try again.
              </p>
              <Button onClick={handleGenerate}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* App Download Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Get the iOS App</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription>
              The AmakaFlow iOS Companion app is coming soon to the App Store.
              Sign up for notifications to be the first to know when it's available.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1" disabled>
              <ExternalLink className="w-4 h-4 mr-2" />
              Download from App Store
              <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-medium text-sm">iOS App Features:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- View and manage your workouts on the go</li>
              <li>- Quick workout logging during gym sessions</li>
              <li>- Offline access to your workout library</li>
              <li>- Apple Watch integration for guided workouts</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>Pairing codes expire in 5 minutes</strong> and can only be used once.
              This ensures secure device authentication.
            </p>
            <p>
              Your data is encrypted in transit and at rest. The iOS app uses
              secure token storage via the iOS Keychain.
            </p>
            <p>
              You can revoke access to any paired device at any time from your account settings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}