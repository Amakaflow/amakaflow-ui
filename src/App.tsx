import { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner@2.0.3';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Dumbbell, Settings, ChevronRight, ArrowLeft, History, BarChart3, Users, Activity } from 'lucide-react';
import { AddSources, Source } from './components/AddSources';
import { StructureWorkout } from './components/StructureWorkout';
import { ValidateMap } from './components/ValidateMap';
import { PublishExport } from './components/PublishExport';
import { WorkoutHistory } from './components/WorkoutHistory';
import { Analytics } from './components/Analytics';
import { TeamSharing } from './components/TeamSharing';
import { UserSettings } from './components/UserSettings';
import { StravaEnhance } from './components/StravaEnhance';
import { ProfileCompletion } from './components/ProfileCompletion';
import { WelcomeGuide } from './components/WelcomeGuide';
import { WorkoutStructure, ExportFormats, ValidationResponse } from './types/workout';
import { generateWorkoutStructure as generateWorkoutStructureReal, checkApiHealth } from './lib/api';
import { generateWorkoutStructure as generateWorkoutStructureMock } from './lib/mock-api';
import { 
  validateWorkoutMapping, 
  processWorkoutWithValidation, 
  exportWorkoutToDevice,
  checkMapperApiHealth 
} from './lib/mapper-api';
import { DeviceId } from './lib/devices';
import { saveWorkoutToHistory, getWorkoutHistory } from './lib/workout-history';
import { useClerkUser, getUserProfileFromClerk, syncClerkUserToProfile } from './lib/clerk-auth';
import { User } from './types/auth';
import { isAccountConnectedSync, isAccountConnected } from './lib/linked-accounts';

type AppUser = User & {
  avatar?: string;
  mode: 'individual' | 'trainer';
};

type WorkflowStep = 'add-sources' | 'structure' | 'validate' | 'export';
type View = 'home' | 'workflow' | 'profile' | 'history' | 'analytics' | 'team' | 'settings' | 'strava-enhance';

export default function App() {
  // Clerk authentication
  const { user: clerkUser, isLoaded: clerkLoaded } = useClerkUser();
  
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [currentView, setCurrentView] = useState<'home' | 'workflow' | 'profile' | 'history' | 'analytics' | 'team' | 'settings' | 'strava-enhance'>('home');
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('add-sources');
  const [showStravaEnhance, setShowStravaEnhance] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [workout, setWorkout] = useState<WorkoutStructure | null>(null);
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [exports, setExports] = useState<ExportFormats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceId>('garmin');
  const [workoutHistoryList, setWorkoutHistoryList] = useState<any[]>([]);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [instagramCredentials, setInstagramCredentials] = useState<{ username: string; password: string } | null>(null);

  const steps: Array<{ id: WorkflowStep; label: string; number: number }> = [
    { id: 'add-sources', label: 'Add Sources', number: 1 },
    { id: 'structure', label: 'Structure Workout', number: 2 },
    { id: 'validate', label: 'Validate & Map', number: 3 },
    { id: 'export', label: 'Publish & Export', number: 4 }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  // Check API availability on mount
  useEffect(() => {
    checkApiHealth().then((available) => {
      setApiAvailable(available);
    }).catch(() => {
      setApiAvailable(false);
    });
  }, []);


  // Check if Clerk is configured
  const hasClerk = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY && 
                   !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY.includes('placeholder');

  // Sync Clerk user with Supabase profile, or create default user if Clerk not configured
  useEffect(() => {
    const syncUser = async () => {
      // If Clerk not configured, create default user for development
      if (!hasClerk && !user) {
        setAuthLoading(true);
        const defaultUser: AppUser = {
          id: 'dev-user',
          email: 'dev@example.com',
          name: 'Developer',
          subscription: 'free',
          workoutsThisWeek: 0,
          selectedDevices: ['garmin'], // Pre-select Garmin as default device for dev mode
          mode: 'individual',
        };
        setUser(defaultUser);
        setAuthLoading(false);
        return;
      }

      // If Clerk is configured but not loaded yet, wait
      if (hasClerk && !clerkLoaded) {
        // Clerk is still loading
        return;
      }

      setAuthLoading(true);
      try {
        if (clerkUser) {
          console.log('Clerk user found, syncing with profile:', clerkUser.id);
          // Sync Clerk user to Supabase profile
          const profile = await syncClerkUserToProfile(clerkUser);
          if (profile) {
            setUser({
              ...profile,
              avatar: clerkUser.imageUrl,
              mode: 'individual' as const,
            });
          } else {
            // Profile creation failed, but we still have Clerk user
            // Create a temporary user object
            const email = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress || '';
            const name = clerkUser.firstName && clerkUser.lastName
              ? `${clerkUser.firstName} ${clerkUser.lastName}`
              : clerkUser.firstName || clerkUser.username || email.split('@')[0];
            
            const tempUser: AppUser = {
              id: clerkUser.id,
              email: email,
              name: name,
              subscription: 'free',
              workoutsThisWeek: 0,
              selectedDevices: [],
              mode: 'individual',
              avatar: clerkUser.imageUrl,
            };
            setUser(tempUser);
          }
          // Check Strava connection status from Supabase
          if (clerkUser?.id) {
            try {
              const connected = await isAccountConnected(clerkUser.id, 'strava');
              setStravaConnected(connected);
            } catch (error) {
              console.error('Error checking Strava connection:', error);
              setStravaConnected(false);
            }
          } else {
            setStravaConnected(false);
          }
        } else {
          // No Clerk user, clear app user
          setUser(null);
          setStravaConnected(false);
        }
      } catch (error: any) {
        console.error('Error syncing Clerk user:', error);
        toast.error(`Error: ${error.message || 'Failed to sync user'}`);
      } finally {
        setAuthLoading(false);
      }
    };

    syncUser();
  }, [clerkUser, clerkLoaded, hasClerk]);

  // Check if profile needs completion
  const needsProfileCompletion = (user: AppUser | null): boolean => {
    if (!user) return false;
    
    // Skip profile completion if Clerk is not configured (dev mode)
    if (!hasClerk) {
      return false;
    }
    
    // Profile needs completion if:
    // 1. No devices selected AND
    // 2. Strava is not connected
    const hasDevices = user.selectedDevices && user.selectedDevices.length > 0;
    const hasStrava = isAccountConnectedSync('strava');
    return !hasDevices && !hasStrava;
  };

  // Load user profile from Supabase (for Clerk user)
  const loadUserProfile = async (clerkUserId: string, retryCount = 0) => {
    try {
      console.log(`Loading profile for Clerk user ${clerkUserId} (attempt ${retryCount + 1})`);
      const profile = await getUserProfileFromClerk(clerkUserId);
      
      if (profile) {
        console.log('Profile found:', profile);
        console.log('Selected devices:', profile.selectedDevices, 'Length:', profile.selectedDevices.length);
        setUser({
          ...profile,
          avatar: clerkUser?.imageUrl,
          mode: 'individual' as const,
        });
      } else {
        console.log('No profile found, retry count:', retryCount);
        // Profile might not be created yet
        // Retry up to 3 times with increasing delays
        if (retryCount < 3) {
          console.log(`Retrying in ${500 * (retryCount + 1)}ms...`);
          setTimeout(() => {
            loadUserProfile(clerkUserId, retryCount + 1);
          }, 500 * (retryCount + 1)); // 500ms, 1000ms, 1500ms
          return;
        }
        
        // If profile still doesn't exist after retries, sync it
        console.log('Profile still not found after retries, syncing Clerk user');
        if (clerkUser) {
          const syncedProfile = await syncClerkUserToProfile(clerkUser);
          if (syncedProfile) {
            setUser({
              ...syncedProfile,
              avatar: clerkUser.imageUrl,
              mode: 'individual' as const,
            });
          }
        }
      }
      // Check Strava connection status from Supabase
      if (clerkUserId) {
        try {
          const connected = await isAccountConnected(clerkUserId, 'strava');
          setStravaConnected(connected);
        } catch (error) {
          console.error('Error checking Strava connection:', error);
          setStravaConnected(false);
        }
      } else {
        setStravaConnected(false);
      }
    } catch (error: any) {
      console.error('Error loading user profile:', error);
      // Only show toast for non-404 errors (profile not found is expected for new users)
      if (error?.code !== 'PGRST116') {
        toast.error(`Error loading profile: ${error.message || 'Unknown error'}`);
      }
    }
  };

  // Handle profile completion
  const handleProfileComplete = async (updatedUser: User) => {
    setUser({
      ...updatedUser,
      avatar: undefined,
      mode: 'individual' as const,
    });
    // Refresh Strava connection status from Supabase
    if (updatedUser.id) {
      try {
        const connected = await isAccountConnected(updatedUser.id, 'strava');
        setStravaConnected(connected);
      } catch (error) {
        console.error('Error checking Strava connection:', error);
        setStravaConnected(false);
      }
    } else {
      setStravaConnected(false);
    }
  };

  // Handle logout (Clerk handles this automatically via UserButton)
  // This is kept for compatibility but Clerk's UserButton handles sign out
  const handleLogout = async () => {
    setUser(null);
    setStravaConnected(false);
  };

  // Load workout history on mount (only when user is logged in)
  useEffect(() => {
    if (user) {
      const history = getWorkoutHistory();
      setWorkoutHistoryList(history);
    }
  }, [user]);

  const handleStartNew = () => {
    setSources([]);
    setWorkout(null);
    setValidation(null);
    setExports(null);
    setCurrentStep('add-sources');
    setCurrentView('workflow');
  };

  const handleGenerateStructure = async (newSources: Source[]) => {
    setLoading(true);
    try {
      // Check if API is available
      const isApiAvailable = apiAvailable !== false ? await checkApiHealth() : false;
      
      // Update API availability state
      setApiAvailable(isApiAvailable);
      
      const sourcesData = newSources.map(s => ({ type: s.type, content: s.content }));
      
      // Check if we have Instagram sources that need credentials
      const hasInstagram = newSources.some(s => s.type === 'instagram');
      
      if (hasInstagram && isApiAvailable && !instagramCredentials) {
        // Prompt for Instagram credentials
        const username = prompt('Instagram Username:');
        const password = prompt('Instagram Password (required for private posts):');
        if (username && password) {
          setInstagramCredentials({ username, password });
        } else {
          throw new Error('Instagram credentials required');
        }
      }
      
      // Use real API if available, otherwise fall back to mock
      let structure: WorkoutStructure;
      if (isApiAvailable) {
        try {
          structure = await generateWorkoutStructureReal(sourcesData, instagramCredentials || undefined);
        } catch (apiError: any) {
          // If API call fails, throw the error (don't silently fall back to mock)
          throw new Error(`API error: ${apiError.message || 'Failed to generate workout'}`);
        }
      } else {
        structure = await generateWorkoutStructureMock(sourcesData);
      }
        
      setWorkout(structure);
      setSources(newSources);
      setCurrentStep('structure');
      toast.success('Workout structure generated!');
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to generate workout';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadTemplate = (template: WorkoutStructure) => {
    setWorkout(template);
    setSources([]);
    setCurrentStep('structure');
    toast.success(`Loaded template: ${template.title}`);
  };

  const handleAutoMap = async () => {
    if (!workout) return;
    setLoading(true);
    try {
      // Check if mapper API is available
      const isMapperApiAvailable = await checkMapperApiHealth();
      
      if (isMapperApiAvailable) {
        // Use real mapper API - process workout and export to selected device
        const exportFormats = await exportWorkoutToDevice(workout, selectedDevice);
        setExports(exportFormats);
        
        // Also validate to show in export view
        const validationResult = await validateWorkoutMapping(workout);
        setValidation(validationResult);
      } else {
        // Fallback to mock if API unavailable
        const { processWorkflow } = await import('./lib/mock-api');
        const exportFormats = await processWorkflow(workout, true);
        setExports(exportFormats);
      }
      
      // Save to history
      if (user) {
        await saveWorkoutToHistory(user.id, workout, selectedDevice);
      }
      
      setCurrentStep('export');
      toast.success('Workout auto-mapped and ready to export!');
      
      // Refresh history
      if (user) {
        const history = await getWorkoutHistory(user.id);
        setWorkoutHistoryList(history);
      }
    } catch (error: any) {
      toast.error(`Failed to auto-map workout: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!workout) return;
    setLoading(true);
    try {
      // Check if mapper API is available
      const isMapperApiAvailable = await checkMapperApiHealth();
      
      let validationResult: ValidationResponse;
      if (isMapperApiAvailable) {
        // Use real mapper API
        validationResult = await validateWorkoutMapping(workout);
      } else {
        // Fallback to mock if API unavailable
        const { validateWorkout } = await import('./lib/mock-api');
        validationResult = await validateWorkout(workout);
      }
      
      setValidation(validationResult);
      setCurrentStep('validate');
      if (validationResult.can_proceed) {
        toast.success('All exercises validated successfully!');
      } else {
        toast.warning('Some exercises need review');
      }
    } catch (error: any) {
      toast.error(`Failed to validate workout: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReValidate = async (updatedWorkout: WorkoutStructure) => {
    setLoading(true);
    try {
      // Check if mapper API is available
      const isMapperApiAvailable = await checkMapperApiHealth();
      
      let validationResult: ValidationResponse;
      if (isMapperApiAvailable) {
        // Use real mapper API with updated workout
        validationResult = await validateWorkoutMapping(updatedWorkout);
      } else {
        // Fallback to mock if API unavailable
        const { validateWorkout } = await import('./lib/mock-api');
        validationResult = await validateWorkout(updatedWorkout);
      }
      
      setValidation(validationResult);
      setWorkout(updatedWorkout); // Update the workout state as well
      toast.success('Re-validation complete');
    } catch (error: any) {
      toast.error(`Failed to re-validate workout: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (updatedWorkout: WorkoutStructure) => {
    setLoading(true);
    try {
      // Check if mapper API is available
      const isMapperApiAvailable = await checkMapperApiHealth();
      
      let exportFormats: ExportFormats;
      let validationResult: ValidationResponse | null = null;
      
      if (isMapperApiAvailable) {
        // Use real mapper API - process workout with validation and export to selected device
        const processResult = await processWorkoutWithValidation(updatedWorkout, false);
        validationResult = processResult.validation;
        
        // If validation passes, export to selected device
        if (processResult.validation.can_proceed || processResult.yaml) {
          // Try to export to device-specific format
          try {
            exportFormats = await exportWorkoutToDevice(updatedWorkout, selectedDevice);
            // If device export has yaml, prefer it over process result yaml
            if (!exportFormats.yaml && processResult.yaml) {
              exportFormats.yaml = processResult.yaml;
            }
          } catch (deviceError) {
            // If device export fails, use the yaml from process result
            exportFormats = { yaml: processResult.yaml || '' };
          }
        } else {
          // Validation didn't pass, but we still have the validation result
          exportFormats = { yaml: processResult.yaml || '' };
        }
      } else {
        // Fallback to mock if API unavailable
        const { processWorkflow } = await import('./lib/mock-api');
        exportFormats = await processWorkflow(updatedWorkout, false);
      }
      
      setExports(exportFormats);
      setValidation(validationResult);
      setWorkout(updatedWorkout); // Update the workout state as well
      setCurrentStep('export');
      toast.success(`Workout processed for ${selectedDevice === 'garmin' ? 'Garmin' : selectedDevice === 'apple' ? 'Apple Watch' : 'Zwift'}!`);
      
      // Save to history
      if (user) {
        await saveWorkoutToHistory(user.id, updatedWorkout, selectedDevice);
        const history = await getWorkoutHistory(user.id);
        setWorkoutHistoryList(history);
      }
    } catch (error: any) {
      toast.error(`Failed to process workout: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFromHistory = (historyItem: any) => {
    setWorkout(historyItem.workout);
    setSources(historyItem.sources.map((s: string) => {
      const [type, ...content] = s.split(':');
      return { id: Math.random().toString(), type, content: content.join(':') };
    }));
    setSelectedDevice(historyItem.device);
    setCurrentStep('structure');
    setCurrentView('workflow');
    toast.success('Workout loaded from history');
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  };

  // Show loading while Clerk initializes (only if Clerk is configured) or auth is loading
  if ((hasClerk && !clerkLoaded) || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show sign-in UI if Clerk is configured but user is not authenticated
  // OR if no user exists at all (shouldn't happen, but safety check)
  if (hasClerk && !clerkUser) {
    return (
      <>
        <Toaster position="top-center" />
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-primary/10">
          <div className="w-full max-w-md space-y-4 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
                <Dumbbell className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold">MyAmaka/AmakaFlow</h1>
              <p className="mt-2 text-muted-foreground">
                Transform workout content into structured training for your devices
              </p>
            </div>
            <div className="space-y-2">
              <SignInButton mode="modal">
                <Button className="w-full">Sign In</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button variant="outline" className="w-full">Sign Up</Button>
              </SignUpButton>
            </div>
          </div>
        </div>
      </>
    );
  }

  // If Clerk not configured but no user exists yet, show loading
  // (This should only happen briefly while dev user is being created)
  if (!hasClerk && !user && authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If Clerk user exists but profile not loaded yet, show loading
  if (!user && clerkUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Safety check: if no user exists at all (shouldn't happen), show sign-in or error
  if (!user) {
    // If Clerk is configured, show sign-in
    if (hasClerk) {
      return (
        <>
          <Toaster position="top-center" />
          <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-primary/10">
            <div className="w-full max-w-md space-y-4 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
                  <Dumbbell className="w-8 h-8 text-primary-foreground" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold">MyAmaka/AmakaFlow</h1>
                <p className="mt-2 text-muted-foreground">
                  Transform workout content into structured training for your devices
                </p>
              </div>
              <div className="space-y-2">
                <SignInButton mode="modal">
                  <Button className="w-full">Sign In</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button variant="outline" className="w-full">Sign Up</Button>
                </SignUpButton>
              </div>
            </div>
          </div>
        </>
      );
    }
    // If Clerk not configured and no user, still loading or error
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show profile completion if needed
  if (needsProfileCompletion(user)) {
    return (
      <>
        <Toaster position="top-center" />
        <ProfileCompletion user={user} onComplete={handleProfileComplete} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" />
      
      {/* Navigation Bar */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Dumbbell className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span>AmakaFlow</span>
                    <Badge variant="secondary" className="text-xs">
                      {user.subscription}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{user.name}</p>
                </div>
              </div>
              
              <nav className="hidden md:flex items-center gap-1">
                <Button
                  variant={currentView === 'workflow' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentView('workflow')}
                >
                  Workflow
                </Button>
                <Button
                  variant={currentView === 'history' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentView('history')}
                  className="gap-2"
                >
                  <History className="w-4 h-4" />
                  History
                </Button>
                <Button
                  variant={currentView === 'analytics' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentView('analytics')}
                  className="gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </Button>
                <Button
                  variant={currentView === 'team' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentView('team')}
                  className="gap-2"
                >
                  <Users className="w-4 h-4" />
                  Team
                </Button>
                {stravaConnected && (
                  <Button
                    variant={currentView === 'strava-enhance' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentView('strava-enhance')}
                    className="gap-2 text-orange-600 hover:text-orange-600"
                  >
                    <Activity className="w-4 h-4" />
                    Enhance Strava
                  </Button>
                )}
              </nav>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentView('settings')}
                className="gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Button>
              {import.meta.env.VITE_CLERK_PUBLISHABLE_KEY && !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY.includes('placeholder') && (
                <UserButton afterSignOutUrl="/" />
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Workflow Header (only shown in workflow view) */}
      {currentView === 'workflow' && (
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-6">
            <div className="mb-6">
              <h1 className="text-2xl">Create Workout</h1>
              <p className="text-sm text-muted-foreground">
                Ingest → Structure → Validate → Export
              </p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {steps.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        currentStep === step.id
                          ? 'bg-primary text-primary-foreground'
                          : currentStepIndex > idx
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {step.number}
                    </div>
                    <div
                      className={`text-sm ${
                        currentStep === step.id
                          ? ''
                          : currentStepIndex > idx
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </div>
                  </div>
                  {idx < steps.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground mx-2" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

           {/* Main Content */}
           <div className={`container mx-auto px-4 py-8 ${currentView === 'workflow' && workout ? 'pb-32' : ''}`}>
        {/* Welcome Guide (shown on home view) */}
        {currentView === 'home' && (
          <WelcomeGuide 
            onGetStarted={() => {
              setCurrentView('workflow');
              setCurrentStep('add-sources');
            }}
          />
        )}

        {currentView === 'workflow' && currentStepIndex > 0 && (
          <Button variant="ghost" onClick={goBack} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}

        {currentView === 'workflow' && currentStep === 'add-sources' && (
          <AddSources 
            onGenerate={handleGenerateStructure} 
            onLoadTemplate={handleLoadTemplate}
            loading={loading} 
          />
        )}

        {currentView === 'workflow' && currentStep === 'structure' && workout && (
          <StructureWorkout
            workout={workout}
            onWorkoutChange={setWorkout}
            onAutoMap={handleAutoMap}
            onValidate={handleValidate}
            loading={loading}
            selectedDevice={selectedDevice}
            onDeviceChange={setSelectedDevice}
            userSelectedDevices={user.selectedDevices}
          />
        )}

        {currentView === 'workflow' && currentStep === 'validate' && validation && workout && (
          <ValidateMap
            validation={validation}
            workout={workout}
            onReValidate={handleReValidate}
            onProcess={handleProcess}
            loading={loading}
            selectedDevice={selectedDevice}
          />
        )}

        {currentView === 'workflow' && currentStep === 'export' && exports && (
          <PublishExport
            exports={exports}
            validation={validation || undefined}
            sources={sources.map(s => `${s.type}:${s.content}`)}
            onStartNew={handleStartNew}
            selectedDevice={selectedDevice}
            userMode={user.mode}
          />
        )}

        {currentView === 'workflow' && showStravaEnhance && (
          <StravaEnhance
            onClose={() => setShowStravaEnhance(false)}
          />
        )}

        {currentView === 'history' && (
          <WorkoutHistory
            history={workoutHistoryList}
            onLoadWorkout={handleLoadFromHistory}
            onDeleteWorkout={(id) => {
              // TODO: implement delete
              toast.success('Delete functionality coming soon');
            }}
            onEnhanceStrava={(item) => {
              // Navigate to Strava enhance view
              setCurrentView('strava-enhance');
            }}
          />
        )}

        {currentView === 'analytics' && (
          <Analytics
            user={user}
            history={workoutHistoryList}
          />
        )}

        {currentView === 'team' && (
          <TeamSharing
            user={user}
            currentWorkout={workout}
          />
        )}

        {currentView === 'settings' && (
          <UserSettings
            user={user}
            onBack={() => setCurrentView('workflow')}
            onAccountsChange={async () => {
              // Refresh Strava connection status from Supabase
              if (user?.id) {
                try {
                  const connected = await isAccountConnected(user.id, 'strava');
                  setStravaConnected(connected);
                } catch (error) {
                  console.error('Error checking Strava connection:', error);
                  setStravaConnected(false);
                }
              } else {
                setStravaConnected(false);
              }
            }}
            onAccountDeleted={() => {
              // Account was deleted, sign out and reset state
              setUser(null);
              toast.success('Your account has been deleted');
            }}
          />
        )}

        {currentView === 'strava-enhance' && (
          <StravaEnhance
            onClose={() => setCurrentView('workflow')}
          />
        )}
      </div>

      {/* Footer Stats (only in workflow) */}
      {currentView === 'workflow' && workout && (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <Badge variant="outline">{workout.title}</Badge>
                <span className="text-muted-foreground">
                  {workout.blocks.length} block(s)
                </span>
                <span className="text-muted-foreground">
                  {workout.blocks.reduce((sum, block) => 
                    sum + (block.exercises?.length || 0) + (block.supersets?.reduce((s, ss) => s + (ss.exercises?.length || 0), 0) || 0), 0
                  )} exercise(s)
                </span>
              </div>
              {validation && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-green-600">
                    ✓ {validation.validated_exercises.length} validated
                  </span>
                  <span className="text-orange-600">
                    ⚠ {validation.needs_review.length} review
                  </span>
                  <span className="text-red-600">
                    ✗ {validation.unmapped_exercises.length} unmapped
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}