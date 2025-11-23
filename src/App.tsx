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
import { ConfirmDialog } from './components/ConfirmDialog';
import { WorkoutStructure, ExportFormats, ValidationResponse } from './types/workout';
import { generateWorkoutStructure as generateWorkoutStructureReal, checkApiHealth } from './lib/api';
import { generateWorkoutStructure as generateWorkoutStructureMock } from './lib/mock-api';
import { 
  validateWorkoutMapping, 
  processWorkoutWithValidation, 
  exportWorkoutToDevice,
  checkMapperApiHealth 
} from './lib/mapper-api';
import { DeviceId, getDeviceById } from './lib/devices';
import { saveWorkoutToHistory, getWorkoutHistory, getWorkoutHistoryFromLocalStorage } from './lib/workout-history';
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
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [generationAbortController, setGenerationAbortController] = useState<AbortController | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceId>('garmin');
  const [workoutHistoryList, setWorkoutHistoryList] = useState<any[]>([]);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [isEditingFromHistory, setIsEditingFromHistory] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [workoutSaved, setWorkoutSaved] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });
  
  // Build timestamp - shows when app was loaded/updated
  const [buildTimestamp] = useState(() => new Date().toISOString());

  const steps: Array<{ id: WorkflowStep; label: string; number: number }> = [
    { id: 'add-sources', label: 'Add Sources', number: 1 },
    { id: 'structure', label: 'Structure Workout', number: 2 },
    { id: 'validate', label: 'Validate & Map', number: 3 },
    { id: 'export', label: 'Publish & Export', number: 4 }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  // Check API availability on mount (only once, with debounce)
  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const available = await checkApiHealth();
        if (mounted) {
          setApiAvailable(available);
        }
      } catch {
        if (mounted) {
          setApiAvailable(false);
        }
      }
    };
    
    // Delay initial check slightly to avoid race conditions
    const timeoutId = setTimeout(checkHealth, 500);
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
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

  // Sync selectedDevice when user.selectedDevices changes
  useEffect(() => {
    if (user && user.selectedDevices && user.selectedDevices.length > 0) {
      // If current selectedDevice is not in user's selectedDevices, update it
      if (!user.selectedDevices.includes(selectedDevice)) {
        setSelectedDevice(user.selectedDevices[0]);
      }
    }
  }, [user?.selectedDevices]);

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
        
        // Update selectedDevice based on user's selected devices
        if (profile.selectedDevices && profile.selectedDevices.length > 0) {
          // Use the first selected device as the default, but only if current device is not in the list
          if (!profile.selectedDevices.includes(selectedDevice)) {
            setSelectedDevice(profile.selectedDevices[0]);
          }
        }
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
    const loadHistory = async () => {
      if (user?.id) {
        try {
          const history = await getWorkoutHistory(user.id);
          setWorkoutHistoryList(history);
        } catch (error) {
          console.error('Failed to load workout history:', error);
          // Fallback to localStorage
          try {
            const localHistory = getWorkoutHistoryFromLocalStorage();
            setWorkoutHistoryList(localHistory);
          } catch (error) {
            console.error('Failed to load from localStorage:', error);
            setWorkoutHistoryList([]);
          }
        }
      }
    };
    loadHistory();
  }, [user]);

  const handleStartNew = () => {
    setSources([]);
    setWorkout(null);
    setValidation(null);
    setExports(null);
    setCurrentStep('add-sources');
    setCurrentView('workflow');
    setIsEditingFromHistory(false);
    setEditingWorkoutId(null);
  };

  const handleGenerateStructure = async (newSources: Source[]) => {
    // Create abort controller for cancellation
    const abortController = new AbortController();
    setGenerationAbortController(abortController);
    setLoading(true);
    setGenerationProgress('Initializing...');
    
    const loadingToast = toast.loading('Generating workout structure... This may take a minute for complex images.', {
      id: 'generate-structure',
    });
    
    // Progress update interval
    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => {
        if (!prev) return 'Processing...';
        // Cycle through progress messages
        const messages = [
          'Extracting text from image...',
          'Processing OCR data...',
          'Parsing workout structure...',
          'Validating exercises...',
          'Finalizing structure...',
        ];
        const currentIndex = messages.findIndex(m => prev.includes(m.split('...')[0]));
        const nextIndex = currentIndex >= 0 && currentIndex < messages.length - 1 ? currentIndex + 1 : 0;
        return messages[nextIndex];
      });
    }, 10000); // Update every 10 seconds
    
    try {
      setGenerationProgress('Checking API availability...');
      // Check if API is available (use cached value if available, otherwise check)
      let isApiAvailable = apiAvailable;
      if (isApiAvailable === null || isApiAvailable === false) {
        try {
          isApiAvailable = await checkApiHealth();
        } catch {
          isApiAvailable = false;
        }
      }
      
      // Update API availability state
      setApiAvailable(isApiAvailable);
      
      if (abortController.signal.aborted) {
        throw new Error('Generation cancelled');
      }
      
      setGenerationProgress('Preparing sources...');
      const sourcesData = newSources.map(s => ({ type: s.type, content: s.content }));
      
      // Use real API if available, otherwise fall back to mock
      let structure: WorkoutStructure;
      if (isApiAvailable) {
        try {
          setGenerationProgress('Sending request to API...');
          structure = await generateWorkoutStructureReal(sourcesData, abortController.signal);
        } catch (apiError: any) {
          if (apiError.name === 'AbortError' || abortController.signal.aborted) {
            throw new Error('Generation cancelled');
          }
          // If API call fails, throw the error (don't silently fall back to mock)
          throw new Error(`API error: ${apiError.message || 'Failed to generate workout'}`);
        }
      } else {
        structure = await generateWorkoutStructureMock(sourcesData);
      }
      
      if (abortController.signal.aborted) {
        throw new Error('Generation cancelled');
      }
        
      setGenerationProgress('Analyzing quality...');
      
      // Analyze OCR quality BEFORE proceeding to structure page
      const usedVisionAPI = (structure as any)?._usedVisionAPI === true;
      const sourceIsImage = newSources.some(s => s.type === 'image');
      
      // Get current processing method to double-check
      const { getImageProcessingMethod } = await import('./lib/preferences');
      const currentMethod = getImageProcessingMethod();
      const actuallyUsedVision = usedVisionAPI || currentMethod === 'vision';
      
      console.log('OCR Quality Check:', { 
        usedVisionAPI, 
        currentMethod,
        actuallyUsedVision,
        hasStructure: !!structure, 
        structureSource: structure?.source,
        sourceIsImage,
        blocks: structure?.blocks?.length,
        totalExercises: structure?.blocks?.reduce((sum, b) => sum + (b.exercises?.length || 0) + (b.supersets?.reduce((s, ss) => s + (ss.exercises?.length || 0), 0) || 0), 0)
      });
      
      // Check if OCR was used (not Vision API) AND source is an image
      if (!actuallyUsedVision && structure && sourceIsImage) {
        const { analyzeOCRQuality } = await import('./lib/ocr-quality');
        const quality = analyzeOCRQuality(structure, actuallyUsedVision);
        console.log('OCR Quality Result:', quality);
        console.log('OCR Quality Details:', {
          score: quality?.score,
          recommendation: quality?.recommendation,
          totalExercises: quality ? (structure.blocks || []).reduce((sum: number, b: any) => 
            sum + (b.exercises?.length || 0) + (b.supersets?.reduce((s: number, ss: any) => 
              s + (ss.exercises?.length || 0), 0) || 0), 0) : 0,
          issues: quality?.issues,
          issuesCount: quality?.issues?.length
        });
        
        // Block if quality is poor (score < 40 or recommendation is 'poor')
        const shouldBlock = quality && (quality.recommendation === 'poor' || quality.score < 40);
        console.log('Should block progression?', shouldBlock, { 
          score: quality?.score, 
          recommendation: quality?.recommendation,
          scoreCheck: quality?.score < 40,
          recommendationCheck: quality?.recommendation === 'poor',
          issues: quality?.issues?.length,
          qualityExists: !!quality
        });
        
        if (shouldBlock) {
          console.log('🚫 BLOCKING progression due to poor OCR quality:', quality.score, quality.recommendation);
          
          // Block progression - don't go to structure page
          clearInterval(progressInterval);
          setLoading(false);
          setGenerationProgress(null);
          setGenerationAbortController(null);
          
          // Explicitly ensure we stay on add-sources step and don't set workout
          setCurrentStep('add-sources');
          // Do NOT set workout or sources - leave them as they were
          
          toast.dismiss('generate-structure');
          
          // Show error toast with OCR score and action buttons
          toast.error(
            <div className="space-y-3">
              <div className="font-semibold">OCR Quality Too Low: {quality.score}%</div>
              <div className="text-sm">
                This image is too complex for OCR. Please switch to the <strong>AI Vision Model</strong> for better accuracy.
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    const { setImageProcessingMethod } = await import('./lib/preferences');
                    setImageProcessingMethod('vision');
                    toast.success('Switched to Vision API. Please try again.');
                    // Reload to apply changes
                    setTimeout(() => window.location.reload(), 500);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Switch to Vision API
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    checkUnsavedChanges(() => {
                      clearWorkflowState();
                      setCurrentView('settings');
                    });
                  }}
                >
                  Go to Settings
                </Button>
              </div>
            </div>,
            {
              duration: 20000,
              id: 'ocr-quality-block',
            }
          );
          // CRITICAL: Don't proceed - stay on add-sources step
          // Do NOT set workout, sources, or change step
          console.log('✅ RETURNING EARLY - NOT setting workout or changing step');
          // Return early to prevent any further execution
          return; // This should prevent all code below from executing
        }
      }
      
      // Only proceed if we haven't returned above
      console.log('✅ OCR quality acceptable or Vision API used, proceeding to structure page');
      
      // Quality is acceptable OR Vision API was used - proceed to structure page
      // IMPORTANT: This code should NOT execute if quality was poor (we returned above)
      setGenerationProgress('Complete!');
      setWorkout(structure);
      setSources(newSources);
      setCurrentStep('structure');
      setWorkoutSaved(false); // New workout, not saved yet
      clearInterval(progressInterval);
      setLoading(false);
      setGenerationProgress(null);
      setGenerationAbortController(null);
      toast.dismiss('generate-structure');
      toast.success('Workout structure generated!');
    } catch (error: any) {
      clearInterval(progressInterval);
      toast.dismiss('generate-structure');
      const errorMessage = error?.message || 'Failed to generate workout';
      
      if (errorMessage.includes('cancelled')) {
        toast.info('Generation cancelled');
      } else if (errorMessage.includes('timeout')) {
        toast.error(errorMessage, {
          action: {
            label: 'Retry',
            onClick: () => handleGenerateStructure(newSources),
          },
        });
      } else {
        toast.error(errorMessage, {
          action: {
            label: 'Retry',
            onClick: () => handleGenerateStructure(newSources),
          },
        });
      }
    } finally {
      setLoading(false);
      setGenerationProgress(null);
      setGenerationAbortController(null);
    }
  };
  
  const handleCancelGeneration = () => {
    if (generationAbortController) {
      generationAbortController.abort();
      setGenerationAbortController(null);
    }
  };

  const handleLoadTemplate = (template: WorkoutStructure) => {
    setWorkout(template);
    setSources([]);
    setCurrentStep('structure');
    setWorkoutSaved(false); // Template loaded, not saved yet
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
        await saveWorkoutToHistory(user.id, workout, selectedDevice, exports, sources.map(s => `${s.type}:${s.content}`));
        setWorkoutSaved(true); // Mark as saved
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
    if (!workout) {
      toast.error('No workout to validate');
      return;
    }
    setLoading(true);
    try {
      console.log('Starting validation...');
      // Check if mapper API is available
      const isMapperApiAvailable = await checkMapperApiHealth();
      console.log('Mapper API available:', isMapperApiAvailable);
      
      let validationResult: ValidationResponse;
      if (isMapperApiAvailable) {
        // Use real mapper API
        console.log('Calling mapper API for validation...');
        validationResult = await validateWorkoutMapping(workout);
        console.log('Validation result:', validationResult);
      } else {
        // Fallback to mock if API unavailable
        console.log('Mapper API unavailable, using mock validation');
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
      console.error('Validation error:', error);
      const errorMessage = error?.message || 'Unknown error';
      toast.error(`Failed to validate workout: ${errorMessage}`);
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
      const deviceName = getDeviceById(selectedDevice)?.name || selectedDevice;
      toast.success(`Workout processed for ${deviceName}!`);
      
      // Save to history
      if (user) {
        // Convert sources from Source[] to string[]
        const sourcesAsStrings = sources.map(s => `${s.type}:${s.content}`);
        await saveWorkoutToHistory(user.id, updatedWorkout, selectedDevice, exportFormats, sourcesAsStrings, validationResult);
        setWorkoutSaved(true); // Mark as saved
        try {
          const history = await getWorkoutHistory(user.id);
          setWorkoutHistoryList(history);
        } catch (error) {
          console.error('Failed to refresh workout history:', error);
        }
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
    setWorkoutSaved(true); // Loaded from history, already saved
    toast.success('Workout loaded from history');
  };

  const handleEditFromHistory = (historyItem: any) => {
    setWorkout(historyItem.workout);
    setSources(historyItem.sources.map((s: string) => {
      const [type, ...content] = s.split(':');
      return { id: Math.random().toString(), type, content: content.join(':') };
    }));
    setSelectedDevice(historyItem.device);
    setValidation(historyItem.validation || null); // Restore validation if available
    setExports(historyItem.exports || null); // Restore exports if available
    setCurrentStep('structure'); // Start at structure step for editing
    setCurrentView('workflow');
    setIsEditingFromHistory(true); // Mark as editing from history
    setEditingWorkoutId(historyItem.id); // Store the workout ID for saving
    setWorkoutSaved(true); // Initially saved (from history), will be marked unsaved when modified
    toast.success('Workout opened for editing - you can edit directly or re-validate if needed');
  };

  // Helper function to check for unsaved changes and show confirmation
  const checkUnsavedChanges = (onConfirm: () => void): void => {
    // Only show dialog if there are unsaved changes (workout exists but hasn't been saved)
    if (currentView === 'workflow' && (workout || sources.length > 0) && !workoutSaved) {
      setConfirmDialog({
        open: true,
        title: 'Unsaved Changes',
        description: 'Are you sure you want to leave? Any unsaved changes will be lost.',
        onConfirm,
      });
    } else {
      onConfirm();
    }
  };

  // Helper function to clear workflow state
  const clearWorkflowState = () => {
    setWorkout(null);
    setSources([]);
    setValidation(null);
    setExports(null);
    setCurrentStep('add-sources');
    setIsEditingFromHistory(false);
    setEditingWorkoutId(null);
    setWorkoutSaved(false);
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      // Check if there's unsaved work
      if (workout && !isEditingFromHistory) {
        setConfirmDialog({
          open: true,
          title: 'Go Back?',
          description: 'Your current progress will be saved, but you may need to re-validate.',
          onConfirm: () => {
            setCurrentStep(steps[currentStepIndex - 1].id);
          },
        });
        return;
      }
      setCurrentStep(steps[currentStepIndex - 1].id);
    } else if (currentView === 'workflow') {
      // Going back from first step - check for unsaved work
      checkUnsavedChanges(() => {
        setCurrentView('home');
        clearWorkflowState();
      });
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
              <h1 className="text-3xl font-bold">AmakaFlow</h1>
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
                <h1 className="text-3xl font-bold">AmakaFlow</h1>
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
                <Button
                  variant="ghost"
                  className="p-0 h-auto hover:bg-transparent"
                  onClick={() => {
                    checkUnsavedChanges(() => {
                      setCurrentView('home');
                      clearWorkflowState();
                    });
                  }}
                >
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
                </Button>
              </div>
              
              <nav className="hidden md:flex items-center gap-1">
                <Button
                  variant={currentView === 'workflow' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    checkUnsavedChanges(() => {
                      setCurrentView('workflow');
                    });
                  }}
                >
                  Workflow
                </Button>
                <Button
                  variant={currentView === 'history' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    checkUnsavedChanges(() => {
                      clearWorkflowState();
                      setCurrentView('history');
                    });
                  }}
                  className="gap-2"
                >
                  <History className="w-4 h-4" />
                  History
                </Button>
                <Button
                  variant={currentView === 'analytics' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    checkUnsavedChanges(() => {
                      clearWorkflowState();
                      setCurrentView('analytics');
                    });
                  }}
                  className="gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </Button>
                <Button
                  variant={currentView === 'team' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    checkUnsavedChanges(() => {
                      clearWorkflowState();
                      setCurrentView('team');
                    });
                  }}
                  className="gap-2"
                >
                  <Users className="w-4 h-4" />
                  Team
                </Button>
                {stravaConnected && (
                  <Button
                    variant={currentView === 'strava-enhance' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      checkUnsavedChanges(() => {
                        clearWorkflowState();
                        setCurrentView('strava-enhance');
                      });
                    }}
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
                onClick={() => {
                  checkUnsavedChanges(() => {
                    clearWorkflowState();
                    setCurrentView('settings');
                  });
                }}
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
              <h1 className="text-2xl">{isEditingFromHistory ? 'Edit Workout' : 'Create Workout'}</h1>
              <p className="text-sm text-muted-foreground">
                {isEditingFromHistory 
                  ? 'Edit your workout directly or re-validate if needed'
                  : 'Ingest → Structure → Validate → Export'}
              </p>
            </div>

            {/* Progress Steps - Hide when editing from history */}
            {!isEditingFromHistory && (
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
            )}
          </div>
        </div>
      )}

           {/* Main Content */}
           <div className={`container mx-auto px-4 py-8 ${currentView === 'workflow' && workout ? 'pb-32' : ''}`}>
        {/* Welcome Guide (shown on home view) */}
        {currentView === 'home' && (
          <>
            <WelcomeGuide 
              onGetStarted={() => {
                setCurrentView('workflow');
                setCurrentStep('add-sources');
              }}
            />
            {/* Version timestamp */}
            <div className="mt-8 text-center">
              <p className="text-xs text-muted-foreground">
                Build: {new Date(buildTimestamp).toLocaleString()}
              </p>
            </div>
          </>
        )}

        {currentView === 'workflow' && currentStepIndex > 0 && !isEditingFromHistory && (
          <Button variant="ghost" onClick={goBack} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}
        {currentView === 'workflow' && isEditingFromHistory && (
          <Button 
            variant="ghost" 
            onClick={() => {
              // Check if workout has been modified
              if (workout) {
                setConfirmDialog({
                  open: true,
                  title: 'Unsaved Changes',
                  description: 'Are you sure you want to go back? Any unsaved changes will be lost.',
                  onConfirm: () => {
                    setCurrentView('history');
                    setIsEditingFromHistory(false);
                    setEditingWorkoutId(null);
                  },
                });
                return;
              }
              setCurrentView('history');
              setIsEditingFromHistory(false);
              setEditingWorkoutId(null);
            }} 
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to History
          </Button>
        )}

        {currentView === 'workflow' && currentStep === 'add-sources' && (
          <AddSources 
            onGenerate={handleGenerateStructure}
            progress={generationProgress}
            onCancel={handleCancelGeneration} 
            onLoadTemplate={handleLoadTemplate}
            loading={loading} 
          />
        )}

        {currentView === 'workflow' && currentStep === 'structure' && workout && (
          <StructureWorkout
            workout={workout}
            onWorkoutChange={(updatedWorkout) => {
              setWorkout(updatedWorkout);
              setWorkoutSaved(false); // Mark as unsaved when workout is modified
            }}
            onAutoMap={handleAutoMap}
            onValidate={handleValidate}
            onSave={isEditingFromHistory ? async () => {
              if (!user?.id || !workout) return;
              setLoading(true);
              try {
                const { saveWorkoutToHistory } = await import('./lib/workout-history');
                await saveWorkoutToHistory(
                  user.id,
                  workout,
                  selectedDevice,
                  exports || undefined,
                  sources.map(s => `${s.type}:${s.content}`),
                  validation || undefined
                );
                toast.success('Workout saved!');
                setWorkoutSaved(true); // Mark as saved
                // Refresh history
                const { getWorkoutHistory } = await import('./lib/workout-history');
                const history = await getWorkoutHistory(user.id);
                setWorkoutHistoryList(history);
                // Optionally go back to history view
                setCurrentView('history');
                setIsEditingFromHistory(false);
                setEditingWorkoutId(null);
              } catch (error: any) {
                toast.error(`Failed to save workout: ${error.message}`);
              } finally {
                setLoading(false);
              }
            } : undefined}
            isEditingFromHistory={isEditingFromHistory}
            loading={loading}
            selectedDevice={selectedDevice}
            onDeviceChange={setSelectedDevice}
            userSelectedDevices={user.selectedDevices}
            onNavigateToSettings={() => {
              checkUnsavedChanges(() => {
                clearWorkflowState();
                setCurrentView('settings');
              });
            }}
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
            workout={workout}
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
            onEditWorkout={handleEditFromHistory}
            onUpdateWorkout={async (item) => {
              if (!user?.id) return;
              try {
                const { saveWorkoutToAPI } = await import('./lib/workout-api');
                await saveWorkoutToAPI({
                  profile_id: user.id,
                  workout_data: item.workout,
                  sources: item.sources,
                  device: item.device,
                  exports: item.exports,
                  validation: item.validation,
                  title: item.workout.title || `Workout ${new Date().toLocaleDateString()}`,
                });
                toast.success('Workout updated');
                // Refresh history
                const history = await getWorkoutHistory(user.id);
                setWorkoutHistoryList(history);
              } catch (error: any) {
                toast.error(`Failed to update workout: ${error.message}`);
              }
            }}
            onDeleteWorkout={async (id) => {
              try {
                const { deleteWorkoutFromHistory } = await import('./lib/workout-history');
                const deleted = await deleteWorkoutFromHistory(id, user?.id);
                if (deleted) {
                  toast.success('Workout deleted');
                  // Refresh history
                  if (user) {
                    try {
                      const history = await getWorkoutHistory(user.id);
                      setWorkoutHistoryList(history);
                    } catch (error) {
                      console.error('Failed to refresh workout history:', error);
                    }
                  }
                } else {
                  toast.error('Failed to delete workout');
                }
              } catch (error) {
                console.error('Error deleting workout:', error);
                toast.error('Failed to delete workout');
              }
            }}
            onEnhanceStrava={(item) => {
              // Navigate to Strava enhance view
              checkUnsavedChanges(() => {
                clearWorkflowState();
                setCurrentView('strava-enhance');
              });
            }}
          />
        )}

        {currentView === 'analytics' && (
          user ? (
            <Analytics
              user={user}
              history={workoutHistoryList}
            />
          ) : (
            <div className="text-center py-16">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
              <h3 className="text-xl mb-2">Analytics</h3>
              <p className="text-muted-foreground">Please sign in to view analytics</p>
            </div>
          )
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
            onUserUpdate={(updates) => {
              // Update local user state with new device selections
              if (updates.selectedDevices && user) {
                setUser({
                  ...user,
                  selectedDevices: updates.selectedDevices,
                });
                
                // Update selectedDevice if the current device is no longer in selected devices
                // Or use the first selected device if current device is not selected
                if (updates.selectedDevices.length > 0) {
                  if (!updates.selectedDevices.includes(selectedDevice)) {
                    // Current device is not in the selected list, use the first one
                    setSelectedDevice(updates.selectedDevices[0]);
                  }
                } else if (selectedDevice && !updates.selectedDevices.includes(selectedDevice)) {
                  // No devices selected, but we still have a selectedDevice, keep it for now
                  // (user can still export even if device is not in their profile)
                }
              }
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

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        confirmText="Continue"
        cancelText="Cancel"
      />
    </div>
  );
}