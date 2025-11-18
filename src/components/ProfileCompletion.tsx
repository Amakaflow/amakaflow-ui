import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Watch, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Link as LinkIcon
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { AVAILABLE_DEVICES, DeviceId, Device } from '../lib/devices';
import { User } from '../types/auth';
import { updateUserProfileFromClerk } from '../lib/clerk-auth';
import { useClerkUser } from '../lib/clerk-auth';
import { connectAccount, getOAuthUrl, PLATFORM_INFO, LinkedAccountProvider } from '../lib/linked-accounts';

interface ProfileCompletionProps {
  user: User;
  onComplete: (updatedUser: User) => void;
}

export function ProfileCompletion({ user, onComplete }: ProfileCompletionProps) {
  const { user: clerkUser } = useClerkUser();
  const [selectedDevices, setSelectedDevices] = useState<DeviceId[]>(user.selectedDevices || []);
  const [connectStrava, setConnectStrava] = useState(false);
  const [connectOtherAccounts, setConnectOtherAccounts] = useState<'now' | 'later'>('later');
  const [loading, setLoading] = useState(false);
  const [connectingStrava, setConnectingStrava] = useState(false);

  const hasSelection = selectedDevices.length > 0 || connectStrava;
  const error = !hasSelection ? 'Please select at least one device or connect Strava' : null;

  const handleDeviceToggle = (deviceId: DeviceId) => {
    if (selectedDevices.includes(deviceId)) {
      setSelectedDevices(selectedDevices.filter(id => id !== deviceId));
    } else {
      setSelectedDevices([...selectedDevices, deviceId]);
    }
  };

  const handleConnectStrava = async () => {
    setConnectingStrava(true);
    try {
      // Simulate OAuth connection (in production, this would redirect)
      const oauthUrl = getOAuthUrl('strava');
      console.log('Redirecting to Strava OAuth:', oauthUrl);
      
      // For now, simulate connection
      await new Promise(resolve => setTimeout(resolve, 1000));
      connectAccount('strava', ['read_activities', 'write_activities']);
      setConnectStrava(true);
      toast.success('Strava connected successfully!');
    } catch (error) {
      toast.error('Failed to connect Strava');
    } finally {
      setConnectingStrava(false);
    }
  };

  const handleSubmit = async () => {
    if (!hasSelection) {
      toast.error('Please select at least one device or connect Strava');
      return;
    }

    setLoading(true);
    try {
      // Update user profile with selected devices
      // If user connected Strava but didn't select devices, keep empty array
      // If user selected devices, use those
      const devicesToSave = selectedDevices.length > 0 ? selectedDevices : [];

      if (!clerkUser?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await updateUserProfileFromClerk(clerkUser.id, {
        selectedDevices: devicesToSave,
      });

      if (error) {
        throw error;
      }

      // If user chose to connect other accounts now, redirect to settings
      if (connectOtherAccounts === 'now') {
        toast.info('Profile saved! You can connect other accounts in Settings.');
      }

      // Update local user state
      const updatedUser: User = {
        ...user,
        selectedDevices: devicesToSave,
      };

      onComplete(updatedUser);
      toast.success('Profile completed successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  // Group devices by category
  const devicesByCategory = AVAILABLE_DEVICES.reduce((acc, device) => {
    if (!acc[device.category]) {
      acc[device.category] = [];
    }
    acc[device.category].push(device);
    return acc;
  }, {} as Record<string, Device[]>);

  const categoryLabels: Record<string, string> = {
    watch: 'Smartwatches',
    platform: 'Training Platforms',
    tracker: 'Fitness Trackers',
    equipment: 'Equipment',
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <Card className="w-full max-w-3xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl">Complete Your Profile</CardTitle>
            <CardDescription className="mt-2">
              Choose how you'd like to sync your workouts
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Device Selection */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold">Select Devices to Sync</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Choose at least one device or platform where you want to sync your workouts
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-2">
              {Object.entries(devicesByCategory).map(([category, devices]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    {categoryLabels[category] || category}
                  </h4>
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedDevices.includes(device.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleDeviceToggle(device.id)}
                    >
                      <Checkbox
                        checked={selectedDevices.includes(device.id)}
                        onCheckedChange={() => handleDeviceToggle(device.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{device.icon}</span>
                          <Label className="font-medium cursor-pointer">
                            {device.name}
                          </Label>
                          {device.popular && (
                            <Badge variant="secondary" className="text-xs">Popular</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {device.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Strava Connection Option */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-orange-600" />
                  <Label className="text-base font-semibold">Connect Strava</Label>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Sync your workouts with Strava automatically
                </p>
              </div>
              <Button
                variant={connectStrava ? "default" : "outline"}
                onClick={handleConnectStrava}
                disabled={connectingStrava || connectStrava}
                className="gap-2"
              >
                {connectingStrava ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : connectStrava ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Connected
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4" />
                    Connect Strava
                  </>
                )}
              </Button>
            </div>
            {connectStrava && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Strava is connected. You can manage this connection in Settings later.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Other Linked Accounts */}
          <div className="space-y-4 border-t pt-4">
            <div>
              <Label className="text-base font-semibold">Other Linked Accounts</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Connect other platforms like TrainingPeaks, Garmin Connect, etc.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant={connectOtherAccounts === 'now' ? 'default' : 'outline'}
                onClick={() => setConnectOtherAccounts('now')}
                className="flex-1"
              >
                Connect Now
              </Button>
              <Button
                variant={connectOtherAccounts === 'later' ? 'default' : 'outline'}
                onClick={() => setConnectOtherAccounts('later')}
                className="flex-1"
              >
                Maybe Later
              </Button>
            </div>
            {connectOtherAccounts === 'now' && (
              <Alert>
                <AlertDescription>
                  After completing your profile, you'll be able to connect additional accounts in Settings.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={!hasSelection || loading}
              className="flex-1"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Complete Profile'
              )}
            </Button>
          </div>

          {/* Help Text */}
          <p className="text-xs text-center text-muted-foreground">
            You can change these settings anytime in your profile settings
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

