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
import { WorkoutStructure, ExportFormats, ValidationResponse } from './types/workout';
import { generateWorkoutStructure, validateWorkout, processWorkflow } from './lib/mock-api';
import { DeviceId } from './lib/devices';
import { saveWorkoutToHistory, getWorkoutHistory } from './lib/workout-history';
import { useClerkUser, getUserProfileFromClerk, syncClerkUserToProfile } from './lib/clerk-auth';
import { User } from './types/auth';
import { isAccountConnected } from './lib/linked-accounts';

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

  const steps: Array<{ id: WorkflowStep; label: string; number: number }> = [
    { id: 'add-sources', label: 'Add Sources', number: 1 },
    { id: 'structure', label: 'Structure Workout', number: 2 },
    { id: 'validate', label: 'Validate & Map', number: 3 },
    { id: 'export', label: 'Publish & Export', number: 4 }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  // Sync Clerk user with Supabase profile
  useEffect(() => {
    const syncUser = async () => {
      if (!clerkLoaded) {
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
          setStravaConnected(isAccountConnected('strava'));
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
  }, [clerkUser, clerkLoaded]);

  // Check if profile needs completion
  const needsProfileCompletion = (user: AppUser | null): boolean => {
    if (!user) return false;
    // Profile needs completion if:
    // 1. No devices selected AND
    // 2. Strava is not connected
    const hasDevices = user.selectedDevices && user.selectedDevices.length > 0;
    const hasStrava = isAccountConnected('strava');
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
      // Check Strava connection status
      setStravaConnected(isAccountConnected('strava'));
    } catch (error: any) {
      console.error('Error loading user profile:', error);
      // Only show toast for non-404 errors (profile not found is expected for new users)
      if (error?.code !== 'PGRST116') {
        toast.error(`Error loading profile: ${error.message || 'Unknown error'}`);
      }
    }
  };

  // Handle profile completion
  const handleProfileComplete = (updatedUser: User) => {
    setUser({
      ...updatedUser,
      avatar: undefined,
      mode: 'individual' as const,
    });
    // Refresh Strava connection status
    setStravaConnected(isAccountConnected('strava'));
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
      const sourcesData = newSources.map(s => ({ type: s.type, content: s.content }));
      const structure = await generateWorkoutStructure(sourcesData);
      setWorkout(structure);
      setSources(newSources);
      setCurrentStep('structure');
      toast.success('Workout structure generated!');
    } catch (error) {
      toast.error('Failed to generate workout');
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
      console.log('Auto-mapping workout:', workout);
      const exportFormats = await processWorkflow(workout, true);
      console.log('Export formats:', exportFormats);
      setExports(exportFormats);
      
      // Save to history
      saveWorkoutToHistory({
        workout,
        sources: sources.map(s => `${s.type}:${s.content}`),
        device: selectedDevice,
        exports: exportFormats
      });
      
      setCurrentStep('export');
      toast.success('Workout auto-mapped and ready to export!');
      
      // Refresh history
      setWorkoutHistoryList(getWorkoutHistory());
    } catch (error) {
      console.error('Auto-map error:', error);
      toast.error('Failed to auto-map workout');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!workout) return;
    setLoading(true);
    try {
      console.log('Validating workout:', workout);
      const validationResult = await validateWorkout(workout);
      console.log('Validation result:', validationResult);
      setValidation(validationResult);
      setCurrentStep('validate');
      if (validationResult.can_proceed) {
        toast.success('All exercises validated successfully!');
      } else {
        toast.warning('Some exercises need review');
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Failed to validate workout');
    } finally {
      setLoading(false);
    }
  };

  const handleReValidate = async () => {
    if (!workout) return;
    setLoading(true);
    try {
      const validationResult = await validateWorkout(workout);
      setValidation(validationResult);
      toast.success('Re-validation complete');
    } catch (error) {
      toast.error('Failed to re-validate workout');
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (device: DeviceId) => {
    if (!workout) return;
    setLoading(true);
    setSelectedDevice(device);
    try {
      const exportFormats = await processWorkflow(workout, true);
      setExports(exportFormats);
      
      // Save to history
      saveWorkoutToHistory({
        workout,
        sources: sources.map(s => `${s.type}:${s.content}`),
        device,
        exports: exportFormats
      });
      
      setCurrentStep('export');
      toast.success(`Workout processed for ${device === 'garmin' ? 'Garmin' : device === 'apple' ? 'Apple Watch' : 'Zwift'}!`);
      
      // Refresh history
      setWorkoutHistoryList(getWorkoutHistory());
    } catch (error) {
      toast.error('Failed to process workout');
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

  // Show loading while Clerk initializes
  if (!clerkLoaded || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show sign-in UI if not authenticated (Clerk handles this)
  if (!clerkUser) {
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
              <UserButton afterSignOutUrl="/" />
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
      <div className="container mx-auto px-4 py-8">
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

        {currentView === 'workflow' && currentStep === 'validate' && validation && (
          <ValidateMap
            validation={validation}
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
            onAccountsChange={() => {
              // Refresh Strava connection status
              setStravaConnected(isAccountConnected('strava'));
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