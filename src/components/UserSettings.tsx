import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { User, Mail, CreditCard, Bell, Shield, Smartphone, Watch, Bike, ArrowLeft, Link2 } from 'lucide-react';
import { DeviceId } from '../lib/devices';
import { toast } from 'sonner@2.0.3';
import { LinkedAccounts } from './LinkedAccounts';
import { deleteAccount, getUserIdentityProviders } from '../lib/auth';

type Props = {
  user: {
    id: string;
    name: string;
    email: string;
    subscription: string;
    selectedDevices: DeviceId[];
    billingDate?: Date;
  };
  onBack: () => void;
  onAccountsChange?: () => void;
  onAccountDeleted?: () => void;
};

export function UserSettings({ user, onBack, onAccountsChange, onAccountDeleted }: Props) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [selectedDevices, setSelectedDevices] = useState<DeviceId[]>(user.selectedDevices);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);

  useEffect(() => {
    // Load linked OAuth providers
    const loadProviders = async () => {
      const { providers } = await getUserIdentityProviders();
      setLinkedProviders(providers);
    };
    loadProviders();
  }, []);

  const handleSave = () => {
    toast.success('Settings saved successfully');
  };

  const toggleDevice = (device: DeviceId) => {
    if (selectedDevices.includes(device)) {
      setSelectedDevices(selectedDevices.filter(d => d !== device));
    } else {
      setSelectedDevices([...selectedDevices, device]);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await deleteAccount();
      if (error) {
        throw error;
      }
      toast.success('Account deleted successfully');
      onAccountDeleted?.();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error.message || 'Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl">Settings</h2>
          <p className="text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button onClick={handleSave}>Save Changes</Button>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Current Plan</p>
              <p className="text-sm text-muted-foreground">
                {user.subscription === 'free' ? 'Free tier - 5 workouts per week' : 
                 user.subscription === 'pro' ? 'Pro - Unlimited workouts' : 
                 'Team - Unlimited + sharing'}
              </p>
            </div>
            <Badge variant={user.subscription === 'free' ? 'secondary' : 'default'}>
              {user.subscription.toUpperCase()}
            </Badge>
          </div>
          
          {user.billingDate && (
            <div>
              <p className="text-sm text-muted-foreground">
                Next billing date: {user.billingDate.toLocaleDateString()}
              </p>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <p className="text-sm">Available Plans</p>
            <div className="grid gap-3">
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium">Pro</p>
                    <p className="text-sm text-muted-foreground">$9.99/month</p>
                  </div>
                  {user.subscription === 'pro' ? (
                    <Badge>Current</Badge>
                  ) : (
                    <Button size="sm" variant="outline">Upgrade</Button>
                  )}
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ Unlimited workouts</li>
                  <li>✓ All device exports</li>
                  <li>✓ Priority support</li>
                </ul>
              </div>

              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium">Team</p>
                    <p className="text-sm text-muted-foreground">$29.99/month</p>
                  </div>
                  {user.subscription === 'team' ? (
                    <Badge>Current</Badge>
                  ) : (
                    <Button size="sm" variant="outline">Upgrade</Button>
                  )}
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ Everything in Pro</li>
                  <li>✓ Team sharing</li>
                  <li>✓ Up to 10 members</li>
                  <li>✓ Analytics dashboard</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Devices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Connected Devices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select which devices you want to export workouts to
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Watch className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium">Garmin</p>
                  <p className="text-sm text-muted-foreground">Fenix, Forerunner, etc.</p>
                </div>
              </div>
              <Switch
                checked={selectedDevices.includes('garmin')}
                onCheckedChange={() => toggleDevice('garmin')}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Watch className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-medium">Apple Watch</p>
                  <p className="text-sm text-muted-foreground">Series 4 and later</p>
                </div>
              </div>
              <Switch
                checked={selectedDevices.includes('apple')}
                onCheckedChange={() => toggleDevice('apple')}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Bike className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="font-medium">Zwift</p>
                  <p className="text-sm text-muted-foreground">Indoor cycling platform</p>
                </div>
              </div>
              <Switch
                checked={selectedDevices.includes('zwift')}
                onCheckedChange={() => toggleDevice('zwift')}
              />
            </div>
          </div>

          {selectedDevices.length === 0 && (
            <p className="text-sm text-orange-600">
              ⚠ Please select at least one device
            </p>
          )}

          <Button onClick={handleSave}>Save Devices</Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">
                Receive workout summaries and updates
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-muted-foreground">
                Get notified about team shares
              </p>
            </div>
            <Switch
              checked={pushNotifications}
              onCheckedChange={setPushNotifications}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-Sync</p>
              <p className="text-sm text-muted-foreground">
                Automatically sync to connected devices
              </p>
            </div>
            <Switch
              checked={autoSync}
              onCheckedChange={setAutoSync}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start">
            Change Password
          </Button>
          <Button variant="outline" className="w-full justify-start">
            Two-Factor Authentication
          </Button>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              Connected Apps
            </Button>
            {linkedProviders.length > 0 && (
              <div className="pt-2 space-y-2">
                <Label className="text-xs text-muted-foreground">Linked Sign-In Methods:</Label>
                <div className="flex flex-wrap gap-2">
                  {linkedProviders.map((provider) => (
                    <Badge key={provider} variant="secondary" className="capitalize">
                      {provider === 'google' ? 'Google' : provider === 'apple' ? 'Apple' : provider}
                    </Badge>
                  ))}
                </div>
                {linkedProviders.length > 1 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    You can sign in with any of these methods
                  </p>
                )}
              </div>
            )}
          </div>
          
          <Separator />
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account
                  and remove all your data from our servers. Your profile, workout history,
                  and all associated data will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, delete my account'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Linked Accounts */}
      <div className="pt-6">
        <LinkedAccounts onAccountsChange={onAccountsChange} />
      </div>
    </div>
  );
}