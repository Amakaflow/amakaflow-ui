import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
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
import { User, Mail, CreditCard, Bell, Shield, Smartphone, Watch, Bike, ArrowLeft, Link2, ChevronDown, ChevronRight, Settings as SettingsIcon, Info } from 'lucide-react';
import { DeviceId } from '../lib/devices';
import { toast } from 'sonner';
import { LinkedAccounts } from './LinkedAccounts';
import { useClerkUser, useClerkAuth, updateUserProfileFromClerk } from '../lib/clerk-auth';
import { cn } from './ui/utils';
import { getPreferences, savePreferences, ImageProcessingMethod, getImageProcessingMethod, setImageProcessingMethod } from '../lib/preferences';
import { Alert, AlertDescription } from './ui/alert';
import { ENABLE_GARMIN_USB_EXPORT } from '../lib/env';

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
  onUserUpdate?: (updates: { selectedDevices?: DeviceId[] }) => void;
};

type SettingsSection = 'general' | 'account' | 'devices' | 'notifications' | 'security' | 'connected-apps';

export function UserSettings({ user, onBack, onAccountsChange, onAccountDeleted, onUserUpdate }: Props) {
  const { user: clerkUser } = useClerkUser();
  const { signOut } = useClerkAuth();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [selectedDevices, setSelectedDevices] = useState<DeviceId[]>(user.selectedDevices);
    // Derive Garmin USB state from selectedDevices (only if feature flag is enabled)
  const exportGarminUsb = ENABLE_GARMIN_USB_EXPORT && selectedDevices.includes('garmin_usb');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['GENERAL']));
  const [imageProcessingMethod, setImageProcessingMethodState] = useState<ImageProcessingMethod>(getImageProcessingMethod());

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

  useEffect(() => {
    setSelectedDevices(user.selectedDevices);
  }, [user]);


  const handleSave = async () => {
  try {
    // Save image processing preference
    setImageProcessingMethod(imageProcessingMethod);

    if (!clerkUser?.id) return;

    const devicesChanged =
      JSON.stringify([...selectedDevices].sort()) !==
      JSON.stringify([...user.selectedDevices].sort());

    if (!devicesChanged) {
      toast.success('Settings saved successfully');
      return;
    }

    await updateUserProfileFromClerk(clerkUser.id, {
      selectedDevices,
    });

    onUserUpdate?.({ selectedDevices });

    toast.success('Settings and devices saved successfully');
  } catch (error: any) {
    console.error('Error saving settings:', error);
    toast.error(error?.message || 'Failed to save settings. Please try again.');
  }
};

  const handleImageProcessingMethodChange = (method: ImageProcessingMethod) => {
    setImageProcessingMethodState(method);
    setImageProcessingMethod(method);
    toast.success(`Image processing method set to ${method === 'vision' ? 'Vision Model' : 'OCR'}`);
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
                  <CardTitle className="text-lg">Image Processing</CardTitle>
                  <CardDescription>
                    Choose how workout images are processed
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div 
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                        imageProcessingMethod === 'ocr' ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleImageProcessingMethodChange('ocr')}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="ocr" className="text-base font-medium cursor-pointer">
                            OCR (Optical Character Recognition)
                          </Label>
                          <Badge variant="secondary" className="ml-2">Free</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Uses local OCR engine (Tesseract/EasyOCR). Fast and free, works offline.
                          Best for clear, typed text.
                        </p>
                      </div>
                      <Switch
                        id="ocr"
                        checked={imageProcessingMethod === 'ocr'}
                        onCheckedChange={() => handleImageProcessingMethodChange('ocr')}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <div 
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                        imageProcessingMethod === 'vision' ? 'bg-primary/5 border-primary bg-muted/30' : 'bg-muted/30 hover:bg-muted/50'
                      }`}
                      onClick={() => handleImageProcessingMethodChange('vision')}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="vision" className="text-base font-medium cursor-pointer">
                            AI Vision Model
                          </Label>
                          <Badge variant="default" className="ml-2 bg-blue-600">Premium</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Uses OpenAI GPT-4o-mini Vision for superior accuracy. Better for handwritten text,
                          stylized fonts, and complex layouts.
                        </p>
                        <Alert className="mt-3 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                            <strong>Cost:</strong> ~$0.0001-0.0002 per image (very low). 
                            For 1,000 workouts (~6 images each): ~$0.60-1.20. 
                            Pricing will be incorporated into subscription plans in the future.
                          </AlertDescription>
                        </Alert>
                      </div>
                      <Switch
                        id="vision"
                        checked={imageProcessingMethod === 'vision'}
                        onCheckedChange={() => handleImageProcessingMethodChange('vision')}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Your choice applies to all new image uploads. Existing workouts are not affected.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">YouTube Ingestion</CardTitle>
                  <CardDescription>
                    Information about YouTube video workout extraction
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-base font-medium">Transcript Extraction</Label>
                        <Badge variant="secondary">Active</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        We use <a href="https://www.youtube-transcript.io/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">youtube-transcript.io</a> to extract transcripts from YouTube videos.
                      </p>
                      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                          <strong>Free Tier:</strong> 25 transcripts per month
                          <br />
                          Perfect for testing and occasional use. Upgrade to a paid plan for more transcripts if needed.
                        </AlertDescription>
                      </Alert>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-base font-medium">Exercise Extraction</Label>
                        <Badge variant="default" className="bg-blue-600">AI-Powered</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Exercises are extracted from transcripts using <strong>OpenAI GPT-4o-mini</strong> or <strong>Anthropic Claude 3.5 Sonnet</strong> (depending on API key availability).
                      </p>
                      <p className="text-xs text-muted-foreground">
                        The AI identifies exercises, sets, reps, and other workout details from conversational video transcripts, filtering out explanations and non-exercise content.
                      </p>
                      <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                          <strong>Note:</strong> If no OpenAI or Anthropic API key is configured, the system falls back to rule-based extraction (limited to known exercises).
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>

                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        API tokens are configured in the backend environment. Contact support if you need to update your API keys.
                      </p>
                    </div>
                  </CardContent>
                </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI Text Processing</CardTitle>
                  <CardDescription>
                    Information about AI text workout parsing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-base font-medium">Parsing Modes</Label>
                        <Badge variant="secondary">Auto-Detected</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        The workout ingestor now supports <strong>three parsing modes</strong> that are automatically detected:
                      </p>
                      
                      <div className="space-y-3">
                        <div className="border rounded-lg p-3 bg-muted/30">
                          <div className="flex items-start gap-2 mb-2">
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">1. JSON Mode</Badge>
                            <span className="text-xs text-muted-foreground">(Auto-detected)</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Direct JSON input bypasses text parsing entirely. Paste a <code className="text-xs bg-background px-1 py-0.5 rounded">WorkoutStructure</code> JSON object for instant processing.
                          </p>
                          <p className="text-xs font-medium">Format: <code className="text-xs bg-background px-1 py-0.5 rounded">{"{ \"title\": \"...\", \"blocks\": [...] }"}</code></p>
                        </div>

                        <div className="border rounded-lg p-3 bg-muted/30">
                          <div className="flex items-start gap-2 mb-2">
                            <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">2. Canonical Format</Badge>
                            <span className="text-xs text-muted-foreground">(Auto-detected)</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Structured format with <code className="text-xs bg-background px-1 py-0.5 rounded">Title:</code> and <code className="text-xs bg-background px-1 py-0.5 rounded">Block:</code> markers. More reliable than free-form text.
                          </p>
                          <p className="text-xs font-medium">Format:</p>
                          <pre className="text-xs bg-background p-2 rounded mt-1 overflow-x-auto">
{`Title: Workout Name

Block: Warm-Up
- Exercise | 3×8 | type:strength`}
                          </pre>
                        </div>

                        <div className="border rounded-lg p-3 bg-muted/30">
                          <div className="flex items-start gap-2 mb-2">
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400">3. Free-Form Text</Badge>
                            <span className="text-xs text-muted-foreground">(Legacy)</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Traditional bullet-point format. Still supported for backward compatibility.
                          </p>
                          <p className="text-xs font-medium">Formats:</p>
                          <ul className="text-xs text-muted-foreground list-disc list-inside ml-2 mt-1">
                            <li>Bullet points (• Exercise Name – sets×reps)</li>
                            <li>Section headers (Warm-up:, Main:, etc.)</li>
                            <li>Compact format (Exercise – 4×6–8)</li>
                            <li>AMRAP exercises (Exercise – 3×AMRAP)</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-base font-medium">What Gets Parsed</Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        The parser extracts:
                      </p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 ml-2">
                        <li><strong>Workout title</strong> - From the first line or emoji header</li>
                        <li><strong>Blocks</strong> - Workout sections (Warm-Up, Strength Block, etc.)</li>
                        <li><strong>Exercises</strong> - Exercise names with sets and reps</li>
                        <li><strong>Durations</strong> - Time-based intervals and rest periods</li>
                        <li><strong>Supersets</strong> - Grouped exercises with rest between sets</li>
                      </ul>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-base font-medium">Metadata Filtering</Label>
                        <Badge variant="default" className="bg-green-600">Active</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        The parser automatically filters out metadata lines such as:
                      </p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 ml-2">
                        <li>Location, Duration, Frequency, Goal headers</li>
                        <li>Standalone description text (non-exercise content)</li>
                        <li>Separator lines and formatting characters</li>
                      </ul>
                    </div>

                    <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 mt-3">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                        <strong>Auto-Detection:</strong> The system automatically detects which format you're using. JSON is checked first, then canonical format, then free-form text. No manual selection needed!
                      </AlertDescription>
                    </Alert>
                    
                    <div className="text-xs text-muted-foreground space-y-1 mt-3">
                      <p><strong>Recommendations:</strong></p>
                      <ul className="list-disc list-inside ml-2 space-y-0.5">
                        <li>Use <strong>Canonical Format</strong> for AI-generated workouts (most reliable)</li>
                        <li>Use <strong>JSON Mode</strong> for programmatic integrations or power users</li>
                        <li>Free-form text still works but may have parsing edge cases</li>
                      </ul>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      See <code className="text-xs bg-muted px-1 py-0.5 rounded">docs/workspace/CANONICAL_FORMAT_MIGRATION_GUIDE.md</code> for detailed format specifications and migration guide.
                    </p>
                  </div>
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

                    {ENABLE_GARMIN_USB_EXPORT && (
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">Garmin (USB FIT Export)</span>
                          <span className="text-xs text-muted-foreground">
                            Export FIT files for manual USB transfer to your Garmin watch
                          </span>
                        </div>
                        <Switch
                          checked={exportGarminUsb}
                          onCheckedChange={(val) => {
                            setSelectedDevices((prev) => {
                              const hasUsb = prev.includes('garmin_usb');
                              if (val && !hasUsb) {
                                return [...prev, 'garmin_usb'];
                              }
                              if (!val && hasUsb) {
                                return prev.filter((d) => d !== 'garmin_usb');
                              }
                              return prev;
                            });
                          }}
                        />
                      </div>
                    )}

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