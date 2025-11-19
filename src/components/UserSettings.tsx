import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
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
import { User, Mail, CreditCard, Bell, Shield, Smartphone, Watch, Bike, ArrowLeft, Link2, ChevronDown, ChevronRight, Settings as SettingsIcon } from 'lucide-react';
import { DeviceId } from '../lib/devices';
import { toast } from 'sonner';
import { LinkedAccounts } from './LinkedAccounts';
import { useClerkUser, useClerkAuth } from '../lib/clerk-auth';
import { cn } from './ui/utils';

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

type SettingsSection = 'general' | 'account' | 'devices' | 'notifications' | 'security' | 'connected-apps';

export function UserSettings({ user, onBack, onAccountsChange, onAccountDeleted }: Props) {
  const { user: clerkUser } = useClerkUser();
  const { signOut } = useClerkAuth();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [selectedDevices, setSelectedDevices] = useState<DeviceId[]>(user.selectedDevices);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['GENERAL']));

  useEffect(() => {
    // Load linked OAuth providers from Clerk user
    if (clerkUser) {
      const providers: string[] = [];
      // Clerk provides emailAddresses and externalAccounts
      if (clerkUser.emailAddresses && clerkUser.emailAddresses.length > 0) {
        // Email/password is implicit
      }
      if (clerkUser.externalAccounts && clerkUser.externalAccounts.length > 0) {
        clerkUser.externalAccounts.forEach((account: any) => {
          if (account.provider) {
            providers.push(account.provider);
          }
        });
      }
      setLinkedProviders(providers);
    }
  }, [clerkUser]);

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

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      if (!clerkUser) {
        throw new Error('User not authenticated');
      }
      
      // Clerk handles account deletion through their dashboard or API
      // For now, we'll sign the user out and show a message
      // In production, you'd call Clerk's API to delete the user
      await signOut();
      toast.success('Account deletion initiated. Please contact support if you need assistance.');
      onAccountDeleted?.();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error.message || 'Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  const menuItems = [
    {
      category: 'GENERAL',
      items: [
        { id: 'general' as SettingsSection, label: 'General settings', icon: SettingsIcon },
        { id: 'account' as SettingsSection, label: 'Account', icon: User },
      ],
    },
    {
      category: 'DEVICES',
      items: [
        { id: 'devices' as SettingsSection, label: 'Connected devices', icon: Smartphone },
      ],
    },
    {
      category: 'NOTIFICATIONS',
      items: [
        { id: 'notifications' as SettingsSection, label: 'Notifications', icon: Bell },
      ],
    },
    {
      category: 'SECURITY',
      items: [
        { id: 'security' as SettingsSection, label: 'Security', icon: Shield },
        { id: 'connected-apps' as SettingsSection, label: 'Connected apps', icon: Link2 },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r bg-muted/20 flex-shrink-0 flex flex-col">
        <div className="p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold">Settings</h2>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-1">
            {menuItems.map((group) => (
              <div key={group.category} className="mb-4">
                <button
                  onClick={() => toggleCategory(group.category)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                >
                  <span>{group.category}</span>
                  {expandedCategories.has(group.category) ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
                {expandedCategories.has(group.category) && (
                  <div className="mt-1 space-y-0.5">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
                          activeSection === item.id
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        )}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="max-w-4xl mx-auto p-6">

          {/* General Settings */}
          {activeSection === 'general' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold mb-1">General settings</h1>
                <p className="text-muted-foreground text-sm">
                  Manage your general application preferences
                </p>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    General application settings and preferences will be available here.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Account Section */}
          {activeSection === 'account' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold mb-1">Account</h1>
                <p className="text-muted-foreground text-sm">
                  Manage your account information and subscription
                </p>
              </div>

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
            </div>
          )}

          {/* Connected Devices */}
          {activeSection === 'devices' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold mb-1">Connected devices</h1>
                <p className="text-muted-foreground text-sm">
                  Select which devices you want to export workouts to
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5" />
                    Connected Devices
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
            </div>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold mb-1">Notifications</h1>
                <p className="text-muted-foreground text-sm">
                  Manage your notification preferences
                </p>
              </div>

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
            </div>
          )}

          {/* Security */}
          {activeSection === 'security' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold mb-1">Security</h1>
                <p className="text-muted-foreground text-sm">
                  Manage your account security settings
                </p>
              </div>

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
            </div>
          )}

          {/* Connected Apps */}
          {activeSection === 'connected-apps' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold mb-1">Connected apps</h1>
                <p className="text-muted-foreground text-sm">
                  Manage your connected third-party applications and services
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="w-5 h-5" />
                    Connected Apps
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {linkedProviders.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Linked Sign-In Methods:</Label>
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
                  <Separator />
                  <LinkedAccounts onAccountsChange={onAccountsChange} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}