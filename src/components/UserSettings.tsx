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
import { User, Mail, CreditCard, Bell, Shield, Smartphone, Watch, Bike, ArrowLeft, Link2, ChevronDown, ChevronRight, Settings as SettingsIcon, Info, MapPin, Mic, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  VoiceSettings,
  DictionaryCorrection,
  TranscriptionProvider,
  getVoiceSettings,
  updateVoiceSettings,
  getPersonalDictionary,
  syncDictionary,
  deleteCorrection,
  PROVIDER_INFO,
  ACCENT_OPTIONS,
} from '../lib/voice-api';
import { DeletionPreview, getDeletionPreview, deleteAccountData } from '../lib/account-api';
import { DeviceId } from '../lib/devices';
import { toast } from 'sonner';
import { LinkedAccounts } from './LinkedAccounts';
import { useClerkUser, useClerkAuth, updateUserProfileFromClerk } from '../lib/clerk-auth';
import { cn } from './ui/utils';
import { getPreferences, savePreferences, ImageProcessingMethod, getImageProcessingMethod, setImageProcessingMethod } from '../lib/preferences';
import { getPairedDevices } from '../lib/mobile-api';
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
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  onBack: () => void;
  onAccountsChange?: () => void;
  onAccountDeleted?: () => void;
  onUserUpdate?: (updates: { selectedDevices?: DeviceId[], address?: string, city?: string, state?: string, zipCode?: string }) => void;
  onNavigateToMobileCompanion?: () => void;
};

type SettingsSection = 'general' | 'account' | 'voice' | 'devices' | 'notifications' | 'security' | 'connected-apps';

export function UserSettings({ user, onBack, onAccountsChange, onAccountDeleted, onUserUpdate, onNavigateToMobileCompanion }: Props) {
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

  // Location fields
  const [address, setAddress] = useState(user.address || '');
  const [city, setCity] = useState(user.city || '');
  const [state, setState] = useState(user.state || '');
  const [zipCode, setZipCode] = useState(user.zipCode || '');
  const [isEditingLocation, setIsEditingLocation] = useState(false);

  // Paired iOS devices count (AMA-184)
  const [pairedDeviceCount, setPairedDeviceCount] = useState<number>(0);

  // Voice transcription settings (AMA-229)
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings | null>(null);
  const [voiceSettingsLoading, setVoiceSettingsLoading] = useState(false);
  const [voiceSettingsSaving, setVoiceSettingsSaving] = useState(false);
  const [dictionary, setDictionary] = useState<DictionaryCorrection[]>([]);
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const [dictionaryLoaded, setDictionaryLoaded] = useState(false);
  const [newMisheard, setNewMisheard] = useState('');
  const [newCorrected, setNewCorrected] = useState('');
  const [addingCorrection, setAddingCorrection] = useState(false);

  // Account deletion state (AMA-200)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletionPreview, setDeletionPreview] = useState<DeletionPreview | null>(null);
  const [deletionPreviewLoading, setDeletionPreviewLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Fetch paired device count on mount (AMA-184)
  useEffect(() => {
    getPairedDevices()
      .then((devices) => setPairedDeviceCount(devices.length))
      .catch((err) => console.error('Failed to fetch paired devices:', err));
  }, []);

  // Fetch voice settings when voice section is active (AMA-229)
  useEffect(() => {
    if (activeSection === 'voice' && !voiceSettings && !voiceSettingsLoading) {
      setVoiceSettingsLoading(true);
      getVoiceSettings()
        .then((settings) => setVoiceSettings(settings))
        .catch((err) => {
          console.error('Failed to fetch voice settings:', err);
          // Set defaults if fetch fails
          setVoiceSettings({
            provider: 'smart',
            cloud_fallback_enabled: true,
            accent_region: 'en-US',
          });
        })
        .finally(() => setVoiceSettingsLoading(false));
    }
  }, [activeSection, voiceSettings, voiceSettingsLoading]);

  // Fetch personal dictionary when voice section is active (AMA-229)
  useEffect(() => {
    if (activeSection === 'voice' && !dictionaryLoaded && !dictionaryLoading) {
      setDictionaryLoading(true);
      getPersonalDictionary()
        .then((result) => setDictionary(result.corrections))
        .catch((err) => console.error('Failed to fetch dictionary:', err))
        .finally(() => {
          setDictionaryLoading(false);
          setDictionaryLoaded(true);
        });
    }
  }, [activeSection, dictionaryLoaded, dictionaryLoading]);

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

    const locationChanged =
      address !== (user.address || '') ||
      city !== (user.city || '') ||
      state !== (user.state || '') ||
      zipCode !== (user.zipCode || '');

    if (!devicesChanged && !locationChanged) {
      toast.success('Settings saved successfully');
      return;
    }

    await updateUserProfileFromClerk(clerkUser.id, {
      selectedDevices,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      zipCode: zipCode || undefined,
    });

    onUserUpdate?.({
      selectedDevices,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      zipCode: zipCode || undefined,
    });

    setIsEditingLocation(false);
    toast.success('Settings saved successfully');
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

  // Voice settings handlers (AMA-229)
  const handleVoiceProviderChange = async (provider: TranscriptionProvider) => {
    if (!voiceSettings) return;

    const newSettings = { ...voiceSettings, provider };
    setVoiceSettings(newSettings);
    setVoiceSettingsSaving(true);

    try {
      await updateVoiceSettings(newSettings);
      toast.success(`Transcription provider set to ${PROVIDER_INFO[provider].name}`);
    } catch (err) {
      console.error('Failed to update voice settings:', err);
      toast.error('Failed to save voice settings');
      // Revert on failure
      setVoiceSettings(voiceSettings);
    } finally {
      setVoiceSettingsSaving(false);
    }
  };

  const handleCloudFallbackChange = async (enabled: boolean) => {
    if (!voiceSettings) return;

    const newSettings = { ...voiceSettings, cloud_fallback_enabled: enabled };
    setVoiceSettings(newSettings);
    setVoiceSettingsSaving(true);

    try {
      await updateVoiceSettings(newSettings);
      toast.success(enabled ? 'Cloud fallback enabled' : 'Cloud fallback disabled');
    } catch (err) {
      console.error('Failed to update voice settings:', err);
      toast.error('Failed to save voice settings');
      setVoiceSettings(voiceSettings);
    } finally {
      setVoiceSettingsSaving(false);
    }
  };

  const handleAccentChange = async (accent: string) => {
    if (!voiceSettings) return;

    const newSettings = { ...voiceSettings, accent_region: accent };
    setVoiceSettings(newSettings);
    setVoiceSettingsSaving(true);

    try {
      await updateVoiceSettings(newSettings);
      const accentLabel = ACCENT_OPTIONS.find(a => a.value === accent)?.label || accent;
      toast.success(`Accent set to ${accentLabel}`);
    } catch (err) {
      console.error('Failed to update voice settings:', err);
      toast.error('Failed to save voice settings');
      setVoiceSettings(voiceSettings);
    } finally {
      setVoiceSettingsSaving(false);
    }
  };

  const handleAddCorrection = async () => {
    if (!newMisheard.trim() || !newCorrected.trim()) {
      toast.error('Both fields are required');
      return;
    }

    setAddingCorrection(true);
    const newCorrection: DictionaryCorrection = {
      misheard: newMisheard.trim().toLowerCase(),
      corrected: newCorrected.trim(),
      frequency: 1,
    };

    try {
      await syncDictionary([...dictionary, newCorrection]);
      setDictionary([...dictionary, newCorrection]);
      setNewMisheard('');
      setNewCorrected('');
      toast.success('Correction added');
    } catch (err) {
      console.error('Failed to add correction:', err);
      toast.error('Failed to add correction');
    } finally {
      setAddingCorrection(false);
    }
  };

  const handleDeleteCorrection = async (misheard: string) => {
    try {
      await deleteCorrection(misheard);
      setDictionary(dictionary.filter(c => c.misheard !== misheard));
      toast.success('Correction removed');
    } catch (err) {
      console.error('Failed to delete correction:', err);
      toast.error('Failed to remove correction');
    }
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

  // Open delete dialog and fetch deletion preview (AMA-200)
  const handleOpenDeleteDialog = async () => {
    setDeleteDialogOpen(true);
    setDeletionPreviewLoading(true);
    setDeleteConfirmText('');

    try {
      const preview = await getDeletionPreview();
      setDeletionPreview(preview);
    } catch (error: any) {
      console.error('Error fetching deletion preview:', error);
      toast.error('Failed to load account data. Please try again.');
    } finally {
      setDeletionPreviewLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setIsDeleting(true);
    try {
      if (!clerkUser) {
        throw new Error('User not authenticated');
      }

      // Delete all user data from the database via mapper-api
      await deleteAccountData();

      // Sign out from Clerk
      await signOut();

      toast.success('Your account has been deleted.');
      setDeleteDialogOpen(false);
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
        { id: 'voice' as SettingsSection, label: 'Voice transcription', icon: Mic },
      ],
    },
    {
      category: 'DEVICES',
      items: [
        { id: 'devices' as SettingsSection, label: 'Export destinations', icon: Smartphone },
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

                  <Separator />

                  {/* Location Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Location (Optional)</Label>
                      </div>
                      {!isEditingLocation && (user.address || user.city || user.state || user.zipCode) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingLocation(true)}
                          className="h-8"
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Help us suggest nearby gyms and workout locations
                    </p>

                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="settings-address" className="text-sm">Street Address</Label>
                        <Input
                          id="settings-address"
                          type="text"
                          placeholder="123 Main St"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="mt-1"
                          disabled={!isEditingLocation && !!(user.address || user.city || user.state || user.zipCode)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="settings-city" className="text-sm">City</Label>
                          <Input
                            id="settings-city"
                            type="text"
                            placeholder="New York"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="mt-1"
                            disabled={!isEditingLocation && !!(user.address || user.city || user.state || user.zipCode)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="settings-state" className="text-sm">State</Label>
                          <Input
                            id="settings-state"
                            type="text"
                            placeholder="NY"
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            className="mt-1"
                            maxLength={2}
                            disabled={!isEditingLocation && !!(user.address || user.city || user.state || user.zipCode)}
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="settings-zipCode" className="text-sm">Zip Code</Label>
                        <Input
                          id="settings-zipCode"
                          type="text"
                          placeholder="10001"
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                          className="mt-1 w-1/2"
                          maxLength={10}
                          disabled={!isEditingLocation && !!(user.address || user.city || user.state || user.zipCode)}
                        />
                      </div>
                    </div>
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

          {/* Voice Transcription Settings (AMA-229) */}
          {activeSection === 'voice' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold mb-1">Voice Transcription</h1>
                <p className="text-muted-foreground text-sm">
                  Configure how voice input is transcribed for workout creation
                </p>
              </div>

              {voiceSettingsLoading ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading settings...</span>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Provider Selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mic className="w-5 h-5" />
                        Transcription Provider
                      </CardTitle>
                      <CardDescription>
                        Choose how your voice is converted to text
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        {(Object.keys(PROVIDER_INFO) as TranscriptionProvider[]).map((provider) => {
                          const info = PROVIDER_INFO[provider];
                          return (
                            <div
                              key={provider}
                              className={cn(
                                "flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors",
                                voiceSettings?.provider === provider
                                  ? "bg-primary/5 border-primary"
                                  : "hover:bg-muted/50"
                              )}
                              onClick={() => handleVoiceProviderChange(provider)}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Label className="text-base font-medium cursor-pointer">
                                    {info.name}
                                  </Label>
                                  {info.badge && (
                                    <Badge
                                      variant={
                                        info.badge === 'Recommended' ? 'default' :
                                        info.badge === 'Premium' ? 'default' :
                                        info.badge === 'Free' ? 'secondary' : 'outline'
                                      }
                                      className={cn(
                                        info.badge === 'Recommended' && 'bg-emerald-600',
                                        info.badge === 'Premium' && 'bg-blue-600',
                                        info.badge === 'Budget' && 'bg-amber-600'
                                      )}
                                    >
                                      {info.badge}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {info.description}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Cost: {info.cost}
                                </p>
                              </div>
                              <Switch
                                checked={voiceSettings?.provider === provider}
                                onCheckedChange={() => handleVoiceProviderChange(provider)}
                                onClick={(e) => e.stopPropagation()}
                                disabled={voiceSettingsSaving}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Cloud Fallback & Accent Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Advanced Settings</CardTitle>
                      <CardDescription>
                        Fine-tune transcription for better accuracy
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Cloud Fallback Toggle */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <Label className="text-base font-medium">Cloud Fallback</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            Automatically use cloud transcription when on-device confidence is low
                          </p>
                        </div>
                        <Switch
                          checked={voiceSettings?.cloud_fallback_enabled ?? true}
                          onCheckedChange={handleCloudFallbackChange}
                          disabled={voiceSettingsSaving || voiceSettings?.provider === 'deepgram' || voiceSettings?.provider === 'assemblyai'}
                        />
                      </div>

                      {/* Accent Region Selector */}
                      <div className="space-y-2">
                        <Label className="text-base font-medium">Accent Region</Label>
                        <p className="text-sm text-muted-foreground">
                          Select your English accent for better cloud transcription accuracy
                        </p>
                        <Select
                          value={voiceSettings?.accent_region || 'en-US'}
                          onValueChange={handleAccentChange}
                          disabled={voiceSettingsSaving}
                        >
                          <SelectTrigger className="w-full md:w-[280px]">
                            <SelectValue placeholder="Select accent" />
                          </SelectTrigger>
                          <SelectContent>
                            {ACCENT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Personal Dictionary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Personal Dictionary</CardTitle>
                      <CardDescription>
                        Add corrections for words that are frequently misheard
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Add new correction */}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label htmlFor="misheard" className="text-sm">Misheard word</Label>
                          <Input
                            id="misheard"
                            placeholder="e.g., dead lift"
                            value={newMisheard}
                            onChange={(e) => setNewMisheard(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex-1">
                          <Label htmlFor="corrected" className="text-sm">Correct word</Label>
                          <Input
                            id="corrected"
                            placeholder="e.g., deadlift"
                            value={newCorrected}
                            onChange={(e) => setNewCorrected(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <Button
                          onClick={handleAddCorrection}
                          disabled={addingCorrection || !newMisheard.trim() || !newCorrected.trim()}
                          size="icon"
                        >
                          {addingCorrection ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      <Separator />

                      {/* Existing corrections */}
                      {dictionaryLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-sm text-muted-foreground">Loading dictionary...</span>
                        </div>
                      ) : dictionary.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          No corrections yet. Add words that are frequently misheard.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {dictionary.map((correction) => (
                            <div
                              key={correction.misheard}
                              className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                            >
                              <div className="flex items-center gap-4">
                                <span className="text-sm text-muted-foreground line-through">
                                  {correction.misheard}
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-sm font-medium">
                                  {correction.corrected}
                                </span>
                                {correction.frequency > 1 && (
                                  <Badge variant="outline" className="text-xs">
                                    ×{correction.frequency}
                                  </Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCorrection(correction.misheard)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                          Corrections sync across all your devices. The iOS app will automatically
                          apply these corrections during voice transcription.
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}

          {/* Export Destinations */}
          {activeSection === 'devices' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold mb-1">Export Destinations</h1>
                <p className="text-muted-foreground text-sm">
                  Select where you want to send your workouts. Each destination has different export methods.
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5" />
                    Export Destinations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {/* Garmin Connect */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📱</span>
                        <div>
                          <p className="font-medium">Garmin Connect</p>
                          <p className="text-sm text-muted-foreground">Sync via API (requires mapping)</p>
                        </div>
                      </div>
                      <Switch
                        checked={selectedDevices.includes('garmin')}
                        onCheckedChange={() => toggleDevice('garmin')}
                      />
                    </div>

                    {/* Garmin USB */}
                    {ENABLE_GARMIN_USB_EXPORT && (
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">💾</span>
                          <div>
                            <p className="font-medium">Garmin USB</p>
                            <p className="text-sm text-muted-foreground">Download FIT file for manual upload</p>
                          </div>
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

                    {/* COROS */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🏃</span>
                        <div>
                          <p className="font-medium">COROS</p>
                          <p className="text-sm text-muted-foreground">Download FIT for Training Hub</p>
                        </div>
                      </div>
                      <Switch
                        checked={selectedDevices.includes('coros')}
                        onCheckedChange={() => toggleDevice('coros')}
                      />
                    </div>

                    {/* iOS Companion */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📱</span>
                        <div>
                          <p className="font-medium">iOS Companion</p>
                          <p className="text-sm text-muted-foreground">Sync via iOS Companion App (Apple Watch, HealthKit devices)</p>
                        </div>
                      </div>
                      <Switch
                        checked={selectedDevices.includes('apple')}
                        onCheckedChange={() => toggleDevice('apple')}
                      />
                    </div>

                    {/* Android Companion */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📱</span>
                        <div>
                          <p className="font-medium">Android Companion</p>
                          <p className="text-sm text-muted-foreground">Sync via Android Companion App (Wear OS, Health Connect)</p>
                        </div>
                      </div>
                      <Switch
                        checked={selectedDevices.includes('android-companion')}
                        onCheckedChange={() => toggleDevice('android-companion')}
                      />
                    </div>

                    {/* Hevy */}
                    <div className="flex items-center justify-between p-3 border rounded-lg opacity-60">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">💪</span>
                        <div>
                          <p className="font-medium">Hevy</p>
                          <p className="text-sm text-muted-foreground">Coming soon - direct export</p>
                        </div>
                      </div>
                      <Switch
                        checked={selectedDevices.includes('hevy')}
                        onCheckedChange={() => toggleDevice('hevy')}
                        disabled
                      />
                    </div>

                    {/* Zwift */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🚴</span>
                        <div>
                          <p className="font-medium">Zwift</p>
                          <p className="text-sm text-muted-foreground">Download ZWO file</p>
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
                      ⚠ Please select at least one destination
                    </p>
                  )}

                  <Button onClick={handleSave}>Save Destinations</Button>
                </CardContent>
              </Card>

              {/* iOS Companion App */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5" />
                    iOS Companion App
                    {pairedDeviceCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {pairedDeviceCount} {pairedDeviceCount === 1 ? 'device' : 'devices'}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Connect your iPhone to view and sync workouts on the go
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📱</span>
                      <div>
                        <p className="font-medium">
                          {pairedDeviceCount > 0 ? 'Manage iOS Devices' : 'Pair iOS Device'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {pairedDeviceCount > 0
                            ? 'View paired devices or add a new one'
                            : 'Scan a QR code or enter a pairing code to connect'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        console.log('Set Up clicked, onNavigateToMobileCompanion:', !!onNavigateToMobileCompanion);
                        onNavigateToMobileCompanion?.();
                      }}
                    >
                      {pairedDeviceCount > 0 ? 'Manage' : 'Set Up'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The iOS Companion app allows you to view workouts, log exercises during gym sessions, and sync with Apple Watch (native or remote mode), Garmin via HealthKit, and any HealthKit-connected device.
                  </p>
                </CardContent>
              </Card>

              {/* Android Companion App */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5" />
                    Android Companion App
                  </CardTitle>
                  <CardDescription>
                    Connect your Android device to view and sync workouts on the go
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📱</span>
                      <div>
                        <p className="font-medium">Android Companion App</p>
                        <p className="text-sm text-muted-foreground">
                          Download from Google Play and pair with your account
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The Android Companion app allows you to view workouts, log exercises during gym sessions, and sync with Wear OS watches, Samsung Galaxy Watch, Garmin via Health Connect, and any Health Connect device.
                  </p>
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
                  
                  <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full"
                        disabled={isDeleting}
                        onClick={handleOpenDeleteDialog}
                      >
                        {isDeleting ? 'Deleting...' : 'Delete Account'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-lg">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">Delete Your Account</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-4">
                            <p>
                              This action is permanent and cannot be undone. All your data will be deleted.
                            </p>

                            {/* Data Preview */}
                            {deletionPreviewLoading ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-muted-foreground">Loading your data...</span>
                              </div>
                            ) : deletionPreview ? (
                              <div className="space-y-3">
                                <p className="font-medium text-foreground">The following data will be permanently deleted:</p>
                                <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                                  {deletionPreview.workouts > 0 && (
                                    <div className="flex justify-between">
                                      <span>Workouts</span>
                                      <span className="font-medium text-foreground">{deletionPreview.workouts}</span>
                                    </div>
                                  )}
                                  {deletionPreview.workout_completions > 0 && (
                                    <div className="flex justify-between">
                                      <span>Workout completions</span>
                                      <span className="font-medium text-foreground">{deletionPreview.workout_completions}</span>
                                    </div>
                                  )}
                                  {deletionPreview.programs > 0 && (
                                    <div className="flex justify-between">
                                      <span>Programs</span>
                                      <span className="font-medium text-foreground">{deletionPreview.programs}</span>
                                    </div>
                                  )}
                                  {deletionPreview.follow_along_workouts > 0 && (
                                    <div className="flex justify-between">
                                      <span>Follow-along workouts</span>
                                      <span className="font-medium text-foreground">{deletionPreview.follow_along_workouts}</span>
                                    </div>
                                  )}
                                  {deletionPreview.tags > 0 && (
                                    <div className="flex justify-between">
                                      <span>Custom tags</span>
                                      <span className="font-medium text-foreground">{deletionPreview.tags}</span>
                                    </div>
                                  )}
                                  {deletionPreview.voice_corrections > 0 && (
                                    <div className="flex justify-between">
                                      <span>Voice corrections</span>
                                      <span className="font-medium text-foreground">{deletionPreview.voice_corrections}</span>
                                    </div>
                                  )}
                                  {deletionPreview.total_items === 0 && (
                                    <p className="text-muted-foreground italic">No workout data found</p>
                                  )}
                                </div>

                                {/* iOS Device Warning */}
                                {deletionPreview.has_ios_devices && (
                                  <Alert variant="destructive" className="border-orange-500 bg-orange-500/10">
                                    <Smartphone className="h-4 w-4" />
                                    <AlertDescription className="text-sm">
                                      <span className="font-medium">iOS App Detected:</span> You have {deletionPreview.paired_devices} paired iOS device{deletionPreview.paired_devices > 1 ? 's' : ''}.
                                      After deletion, you will need to sign out of the AmakaFlow iOS app manually.
                                      The app will no longer sync with your account.
                                    </AlertDescription>
                                  </Alert>
                                )}

                                {/* External Connections Warning */}
                                {deletionPreview.has_external_connections && (
                                  <Alert className="border-yellow-500 bg-yellow-500/10">
                                    <Link2 className="h-4 w-4" />
                                    <AlertDescription className="text-sm">
                                      <span className="font-medium">Connected Services:</span>{' '}
                                      {deletionPreview.strava_connection && 'Strava'}
                                      {deletionPreview.strava_connection && deletionPreview.garmin_connection && ' and '}
                                      {deletionPreview.garmin_connection && 'Garmin'} connection{deletionPreview.strava_connection && deletionPreview.garmin_connection ? 's' : ''} will be removed.
                                    </AlertDescription>
                                  </Alert>
                                )}
                              </div>
                            ) : null}

                            {/* DELETE Confirmation */}
                            <div className="space-y-2 pt-2">
                              <Label htmlFor="delete-confirm" className="text-foreground font-medium">
                                Type DELETE to confirm
                              </Label>
                              <Input
                                id="delete-confirm"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="DELETE"
                                className="font-mono"
                                disabled={isDeleting}
                              />
                            </div>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel
                          disabled={isDeleting}
                          onClick={() => {
                            setDeleteConfirmText('');
                            setDeletionPreview(null);
                          }}
                        >
                          Cancel
                        </AlertDialogCancel>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteAccount}
                          disabled={isDeleting || deleteConfirmText !== 'DELETE' || deletionPreviewLoading}
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Delete My Account'
                          )}
                        </Button>
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