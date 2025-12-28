import { FitPreviewModal } from "./FitPreviewModal";
import { API_URLS } from '../lib/config';
import { TrainerDistribution } from './TrainerDistribution';
import { Switch } from './ui/switch';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  Download,
  Copy,
  Check,
  Send,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Calendar,
  CalendarPlus,
  X,
  Trash2,
  Activity,
  Save,
  Loader2,
  FolderOpen,
  Info,
  Dumbbell,
  Timer
} from 'lucide-react';
import { ExportFormats, ValidationResponse } from '../types/workout';
import { DeviceId } from '../lib/devices';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';
import { Calendar as CalendarComponent } from './ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { isAccountConnectedSync } from '../lib/linked-accounts';
import { saveWorkoutToAPI, SaveWorkoutRequest, SavedWorkout, getWorkoutFromAPI } from '../lib/workout-api';
import { useClerkUser } from '../lib/clerk-auth';
import { WorkoutStructure } from '../types/workout';
import { WorkoutSelector } from './WorkoutSelector';
import { FollowAlongSetup } from './FollowAlongSetup';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { createStravaActivity, checkAndRefreshStravaToken, StravaTokenExpiredError, StravaUnauthorizedError } from '../lib/strava-api';
import { formatWorkoutForStrava, applyValidationMappings } from '../lib/workout-utils';
import { isAccountConnected } from '../lib/linked-accounts';

interface FitMetadata {
  detected_sport: string;
  detected_sport_id: number;
  warnings: string[];
  exercise_count: number;
  has_running: boolean;
  has_cardio: boolean;
  has_strength: boolean;
}

interface PublishExportProps {
  exports: ExportFormats;
  validation?: ValidationResponse;
  sources: string[];
  onStartNew?: () => void;
  selectedDevice?: DeviceId;
  userMode?: 'individual' | 'trainer';
  workout?: WorkoutStructure;
}

export function PublishExport({ exports, validation, sources, onStartNew, selectedDevice = 'garmin', userMode = 'individual', workout }: PublishExportProps) {
  const { user: clerkUser } = useClerkUser();
  const profileId = clerkUser?.id || '';

  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [scheduledDates, setScheduledDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [recurringType, setRecurringType] = useState<'none' | 'daily' | 'weekly' | 'custom'>('none');
  const [recurringCount, setRecurringCount] = useState<number>(1);
  const [autoEnhanceStrava, setAutoEnhanceStrava] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const [showWorkoutSelector, setShowWorkoutSelector] = useState(false);
  const [isAddingToStrava, setIsAddingToStrava] = useState(false);
  const [isDownloadingFit, setIsDownloadingFit] = useState(false);
  const [fitMetadata, setFitMetadata] = useState<FitMetadata | null>(null);
  const [useLapButton, setUseLapButton] = useState(false);
  const stravaConnected = isAccountConnectedSync('strava');
  const selectedDevices = clerkUser?.selectedDevices || [];
  const hasGarminUsb = Array.isArray(selectedDevices) && selectedDevices.includes('garmin_usb');
  console.log('DEBUG PublishExport hasGarminUsb =', hasGarminUsb);

  // Fetch FIT metadata when workout or lap button setting changes
  useEffect(() => {
    const fetchFitMetadata = async () => {
      if (!workout) return;

      try {
        const MAPPER_API_BASE_URL = API_URLS.MAPPER;
        // Apply validation mappings to use user-confirmed Garmin names
        const mappedWorkout = applyValidationMappings(workout, validation);
        const res = await fetch(`${MAPPER_API_BASE_URL}/map/fit-metadata?use_lap_button=${useLapButton}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks_json: mappedWorkout }),
        });

        if (res.ok) {
          const metadata = await res.json();
          setFitMetadata(metadata);
        }
      } catch (error) {
        console.warn('Failed to fetch FIT metadata:', error);
      }
    };

    fetchFitMetadata();
  }, [workout, useLapButton, validation]);

  const copyToClipboard = async (text: string, format: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      toast.success(`${format.toUpperCase()} copied to clipboard`);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Fetch fresh YAML from mapper API and copy to clipboard
  const copyYaml = async () => {
    if (!workout) {
      toast.error('No workout data');
      return;
    }

    try {
      const MAPPER_API_BASE_URL = API_URLS.MAPPER;
      const mappedWorkout = applyValidationMappings(workout, validation);

      const res = await fetch(`${MAPPER_API_BASE_URL}/map/auto-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks_json: mappedWorkout }),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate YAML: ${res.status}`);
      }

      const data = await res.json();
      const yaml = data.yaml || '';

      // Try clipboard API first
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(yaml);
          setCopiedFormat('YAML');
          toast.success('YAML copied to clipboard');
          setTimeout(() => setCopiedFormat(null), 2000);
          return;
        }
      } catch (clipboardErr) {
        console.warn('copyYaml: Clipboard API failed:', clipboardErr);
      }

      // Fallback: download as file
      const blob = new Blob([yaml], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workout-${Date.now()}.yaml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('YAML downloaded (clipboard not available)');
    } catch (err: any) {
      console.error('copyYaml failed:', err);
      toast.error(`Failed to copy YAML: ${err.message}`);
    }
  };

  const copyDebugJson = async () => {
    if (!workout) {
      toast.error('No workout data to copy');
      console.warn('copyDebugJson: workout is null/undefined');
      return;
    }

    // Include more debug info
    const mappedWorkout = applyValidationMappings(workout, validation);
    const debugData = {
      original_workout: workout,
      mapped_workout: mappedWorkout,
      validation: validation || null,
      exports: exports,
      fit_metadata: fitMetadata || null,
      selectedDevice: selectedDevice,
      timestamp: new Date().toISOString(),
    };

    let jsonStr: string;
    try {
      jsonStr = JSON.stringify(debugData, null, 2);
    } catch (err) {
      console.error('copyDebugJson: Failed to stringify:', err);
      toast.error('Failed to serialize debug data');
      return;
    }

    console.log('copyDebugJson: Copying', jsonStr.length, 'bytes');

    // Try clipboard API first
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(jsonStr);
        toast.success(`Debug JSON copied (${Math.round(jsonStr.length / 1024)}KB)`);
        return;
      }
    } catch (err) {
      console.warn('copyDebugJson: Clipboard API failed:', err);
    }

    // Fallback: download as file
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workout-debug-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Debug JSON downloaded (clipboard not available)');
    } catch (err) {
      console.error('copyDebugJson: Download fallback failed:', err);
      toast.error('Failed to copy or download debug JSON');
    }
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const handleSaveWorkout = async () => {
    if (!workout || !profileId) {
      toast.error('Workout data or user profile missing');
      return;
    }

    setIsSaving(true);
    try {
      const request: SaveWorkoutRequest = {
        profile_id: profileId,
        workout_data: workout,
        sources: sources,
        device: selectedDevice,
        exports: exports,
        validation: validation,
        title: workout.title || `Workout ${new Date().toLocaleDateString()}`,
      };

      const savedWorkout = await saveWorkoutToAPI(request);
      setSavedWorkoutId(savedWorkout.id);
      toast.success('Workout saved successfully!', {
        description: 'You can sync it to your device later from History'
      });
    } catch (error: any) {
      console.error('Failed to save workout:', error);
      toast.error(`Failed to save workout: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectSavedWorkout = async (savedWorkout: SavedWorkout) => {
    setShowWorkoutSelector(false);
    
    try {
      const fullWorkout = await getWorkoutFromAPI(savedWorkout.id, profileId);
      if (fullWorkout) {
        toast.success('Workout loaded!', {
          description: 'You can now sync this workout to your device'
        });
      }
    } catch (error: any) {
      console.error('Failed to load selected workout:', error);
      toast.error(`Failed to load workout: ${error.message || 'Unknown error'}`);
    }
  };

  const sendToDevice = async (platform: string) => {
    if (!savedWorkoutId && workout && profileId) {
      try {
        await handleSaveWorkout();
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('Failed to save workout before sync:', error);
      }
    }

    if (platform === 'Garmin' && import.meta.env.VITE_GARMIN_UNOFFICIAL_SYNC_ENABLED !== "true") {
      toast.error('Garmin Sync (Unofficial API) is disabled', {
        description: 'Enable GARMIN_UNOFFICIAL_SYNC_ENABLED for personal testing'
      });
      return;
    }

    if (platform === 'Garmin' && workout && profileId) {
      try {
        toast.info('Syncing to Garmin (Unofficial API)...', {
          description: 'Importing workout to Garmin Connect'
        });

        const MAPPER_API_BASE_URL = API_URLS.MAPPER;
        
        const syncResponse = await fetch(`${MAPPER_API_BASE_URL}/workout/sync/garmin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blocks_json: workout,
            workout_title: workout.title || 'Workout',
            schedule_date: new Date().toISOString().split('T')[0]
          }),
        });

        if (!syncResponse.ok) {
          const error = await syncResponse.json().catch(() => ({ detail: syncResponse.statusText }));
          throw new Error(error.detail || `Failed to sync: ${syncResponse.statusText}`);
        }

        const syncResult = await syncResponse.json();

        if (!syncResult.success) {
          throw new Error(syncResult.message || 'Failed to sync to Garmin');
        }

        toast.success('Workout synced to Garmin (Unofficial API)!', {
          description: syncResult.message || 'Your workout has been imported to Garmin Connect'
        });
      } catch (error: any) {
        console.error('Failed to sync to Garmin:', error);
        toast.error(`Failed to sync to Garmin: ${error.message || 'Unknown error'}`, {
          description: 'Check console for details'
        });
      }
      return;
    }

    toast.success(`Syncing to ${platform}...`, {
      description: platform === 'Garmin' 
        ? 'Using Unofficial API to sync to Garmin Connect'
        : 'This feature is coming soon'
    });
  };

  const handleDownloadGarminUsbFit = async () => {
    try {
      setIsDownloadingFit(true);

      const workoutJson = workout;

      if (!workoutJson) {
        console.error('No workout data available for export');
        toast.error('No workout data available for export');
        return;
      }

      const workoutId =
        (workout && (workout.id || (workout as any).workoutId)) ||
        (savedWorkoutId) ||
        `workout-${Date.now()}`;

      const title =
        (workout && (workout.title || (workout as any).name)) ||
        'AmakaFlow Workout';

      const MAPPER_API_BASE_URL = API_URLS.MAPPER;
      // Apply validation mappings to use user-confirmed Garmin names
      const mappedWorkout = applyValidationMappings(workout, validation);
      const res = await fetch(`${MAPPER_API_BASE_URL}/map/to-fit?use_lap_button=${useLapButton}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blocks_json: mappedWorkout }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Failed to generate FIT file', res.status, text);
        toast.error('Failed to generate FIT file');
        return;
      }

      const blob = await res.blob();

      const disposition = res.headers.get('content-disposition') || '';
      let filename = 'workout.fit';
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('FIT file downloaded. Copy it to your Garmin watch via USB.');
    } catch (err) {
      console.error('Error downloading Garmin USB FIT', err);
      toast.error('Failed to download FIT file');
    } finally {
      setIsDownloadingFit(false);
    }
  };

  const handleAddToStrava = async () => {
    if (!workout || !profileId) {
      toast.error('Workout data or user profile missing');
      return;
    }

    setIsAddingToStrava(true);
    try {
      const isConnected = await isAccountConnected(profileId, 'strava');
      if (!isConnected) {
        toast.error('Please connect your Strava account first via OAuth in Settings');
        setIsAddingToStrava(false);
        return;
      }

      const tokenValid = await checkAndRefreshStravaToken(profileId);
      if (!tokenValid) {
        const isStillConnected = await isAccountConnected(profileId, 'strava');
        if (!isStillConnected) {
          toast.error('Please connect your Strava account first via OAuth in Settings');
          setIsAddingToStrava(false);
          return;
        }
      }

      const description = formatWorkoutForStrava(workout);
      
      let estimatedDuration = 0;
      workout.blocks?.forEach(block => {
        block.exercises?.forEach(exercise => {
          if (exercise.duration_sec) {
            estimatedDuration += exercise.duration_sec;
          }
          if (exercise.rest_sec) {
            estimatedDuration += exercise.rest_sec;
          }
        });
        block.supersets?.forEach(superset => {
          superset.exercises?.forEach(exercise => {
            if (exercise.duration_sec) {
              estimatedDuration += exercise.duration_sec;
            }
            if (exercise.rest_sec) {
              estimatedDuration += exercise.rest_sec;
            }
          });
          if (superset.rest_between_sec) {
            estimatedDuration += superset.rest_between_sec * (superset.exercises?.length || 0);
          }
        });
      });
      
      if (estimatedDuration === 0) {
        estimatedDuration = 30 * 60;
      }

      const activity = await createStravaActivity(profileId, {
        name: workout.title || 'Workout',
        activity_type: 'Workout',
        description: description,
        elapsed_time: estimatedDuration,
      });

      toast.success('Workout added to Strava!', {
        description: `Activity "${activity.name}" created successfully`,
        action: {
          label: 'View on Strava',
          onClick: () => window.open(`https://www.strava.com/activities/${activity.id}`, '_blank'),
        },
      });

      if (!savedWorkoutId) {
        await handleSaveWorkout();
      }
      
    } catch (error: any) {
      console.error('Failed to add workout to Strava:', error);
      
      if (error instanceof StravaTokenExpiredError || error instanceof StravaUnauthorizedError) {
        const isConnected = await isAccountConnected(profileId, 'strava');
        if (!isConnected) {
          toast.error('Please connect your Strava account first via OAuth in Settings');
        } else {
          toast.error('Strava connection expired. Please reconnect via OAuth in Settings');
        }
      } else {
        toast.error(`Failed to add workout to Strava: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsAddingToStrava(false);
    }
  };

  const addScheduledDate = () => {
    if (!selectedDate) return;

    const newDates: Date[] = [selectedDate];

    if (recurringType === 'daily') {
      for (let i = 1; i < recurringCount; i++) {
        const nextDate = new Date(selectedDate);
        nextDate.setDate(nextDate.getDate() + i);
        newDates.push(nextDate);
      }
    } else if (recurringType === 'weekly') {
      for (let i = 1; i < recurringCount; i++) {
        const nextDate = new Date(selectedDate);
        nextDate.setDate(nextDate.getDate() + (i * 7));
        newDates.push(nextDate);
      }
    }

    setScheduledDates([...scheduledDates, ...newDates]);
    setSelectedDate(undefined);
    setRecurringType('none');
    setRecurringCount(1);
    
    toast.success(`Added ${newDates.length} workout${newDates.length > 1 ? 's' : ''} to calendar`);
  };

  const removeScheduledDate = (index: number) => {
    const newDates = scheduledDates.filter((_, i) => i !== index);
    setScheduledDates(newDates);
    toast.success('Removed scheduled workout');
  };

  const syncWithSchedule = () => {
    if (scheduledDates.length === 0) {
      toast.error('Please add at least one scheduled date');
      return;
    }
    
    toast.success(`Syncing ${scheduledDates.length} workout${scheduledDates.length > 1 ? 's' : ''} to ${deviceExport.deviceName}...`, {
      description: `Scheduled for ${scheduledDates.map(d => d.toLocaleDateString()).join(', ')}`
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const supportsScheduling = selectedDevice === 'garmin' || selectedDevice === 'apple';

  const getDeviceExport = () => {
    switch (selectedDevice) {
      case 'garmin':
        return {
          title: 'Garmin Connect Export',
          description: 'YAML format for Garmin watches (Fenix, Forerunner, etc.)',
          format: 'YAML',
          content: exports.yaml,
          filename: 'workout.yaml',
          deviceName: 'Garmin'
        };
      case 'apple':
        return {
          title: 'Apple Watch Export',
          description: 'PLIST format for Apple Watch and Fitness app',
          format: 'PLIST',
          content: exports.plist,
          filename: 'workout.plist',
          deviceName: 'Apple Watch'
        };
      case 'zwift':
        return {
          title: 'Zwift Export',
          description: 'ZWO format for Zwift cycling and running workouts',
          format: 'ZWO',
          content: exports.zwo,
          filename: 'workout.zwo',
          deviceName: 'Zwift'
        };
      default:
        return {
          title: `${selectedDevice.charAt(0).toUpperCase() + selectedDevice.slice(1)} Export`,
          description: `Workout export for ${selectedDevice}`,
          format: 'JSON',
          content: exports.yaml,
          filename: `workout.${selectedDevice}.txt`,
          deviceName: selectedDevice.charAt(0).toUpperCase() + selectedDevice.slice(1)
        };
    }
  };

  const deviceExport = getDeviceExport();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2">Publish & Export</h2>
        <p className="text-muted-foreground">
          Download or sync your workout to {deviceExport.deviceName}
        </p>
      </div>

      {/* Summary */}
      {validation && (
        <Card>
          <CardHeader>
            <CardTitle>Export Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-2xl">{validation.validated_exercises.length}</span>
                </div>
                <div className="text-sm text-muted-foreground">Validated</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <span className="text-2xl">{validation.needs_review.length}</span>
                </div>
                <div className="text-sm text-muted-foreground">Needs Review</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-2xl">{validation.unmapped_exercises.length}</span>
                </div>
                <div className="text-sm text-muted-foreground">Unmapped</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Garmin Export Type Info */}
      {fitMetadata && (selectedDevice === 'garmin' || selectedDevice === 'garmin_usb') && (
        <Card className={fitMetadata.warnings.length > 0 ? 'border-amber-500/50' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="w-4 h-4" />
              Garmin Export Type
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Sport type badge */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Export as:</span>
              <Badge variant={fitMetadata.detected_sport === 'cardio' ? 'default' : 'secondary'} className="capitalize">
                {fitMetadata.detected_sport === 'cardio' ? (
                  <Timer className="w-3 h-3 mr-1" />
                ) : (
                  <Dumbbell className="w-3 h-3 mr-1" />
                )}
                {fitMetadata.detected_sport}
              </Badge>
            </div>

            {/* Exercise type breakdown */}
            <div className="flex gap-2 flex-wrap">
              {fitMetadata.has_strength && (
                <Badge variant="outline" className="text-xs">
                  <Dumbbell className="w-3 h-3 mr-1" />
                  Strength
                </Badge>
              )}
              {fitMetadata.has_running && (
                <Badge variant="outline" className="text-xs">
                  🏃 Running
                </Badge>
              )}
              {fitMetadata.has_cardio && (
                <Badge variant="outline" className="text-xs">
                  <Timer className="w-3 h-3 mr-1" />
                  Cardio machines
                </Badge>
              )}
            </div>

            {/* Lap Button Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">Use Lap Button</span>
                  {useLapButton && (
                    <Badge variant="default" className="text-xs">Active</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Press lap button when done with each exercise instead of counting reps/distance.
                  Recommended for conditioning workouts.
                </p>
              </div>
              <Switch
                checked={useLapButton}
                onCheckedChange={setUseLapButton}
              />
            </div>

            {/* Warnings */}
            {fitMetadata.warnings.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 mt-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-700 dark:text-amber-400">
                    {fitMetadata.warnings.map((warning, idx) => (
                      <p key={idx}>{warning}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Load from Saved Workouts */}
      {profileId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Load Saved Workout
            </CardTitle>
            <CardDescription>
              Select a previously saved workout to sync to your device
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => setShowWorkoutSelector(true)}
              className="w-full"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Browse Saved Workouts
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add to Strava */}
      {stravaConnected && workout && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Add to Strava
            </CardTitle>
            <CardDescription>
              Create a manual workout activity on Strava with structured exercise details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="default"
              onClick={handleAddToStrava}
              disabled={isAddingToStrava}
              className="w-full"
            >
              {isAddingToStrava ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding to Strava...
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 mr-2" />
                  Add to Strava
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Follow-Along Mode */}
      {workout && profileId && (
        <FollowAlongSetup
          workout={workout}
          userId={profileId}
          sourceUrl={sources[0]}
        />
      )}

      {/* Export Formats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sync to {deviceExport.deviceName}</CardTitle>
              <CardDescription>
                Your workout is ready to be synced to your {deviceExport.deviceName} device
              </CardDescription>
            </div>
            <Badge variant="secondary">{deviceExport.format}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-enhance Strava toggle */}
          {stravaConnected && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-orange-600" />
                  <Label className="cursor-pointer">Auto-enhance Strava when synced</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Automatically add structured workout description to your Strava activity after sync
                </p>
              </div>
              <Switch
                checked={autoEnhanceStrava}
                onCheckedChange={(checked) => {
                  setAutoEnhanceStrava(checked);
                  if (checked) {
                    toast.success('Auto-enhance enabled for Strava');
                  }
                }}
              />
            </div>
          )}

          {/* Save Workout Option */}
          {workout && profileId && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Save className="w-4 h-4 text-primary" />
                  <Label className="cursor-pointer font-medium">Save Workout</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {savedWorkoutId 
                    ? 'Workout saved! You can sync it later from History.'
                    : 'Save this workout before syncing to access it later'}
                </p>
              </div>
              <Button
                variant={savedWorkoutId ? "outline" : "default"}
                size="sm"
                onClick={handleSaveWorkout}
                disabled={isSaving || !!savedWorkoutId}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : savedWorkoutId ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            {workout && (
              <FitPreviewModal workout={workout} validation={validation} />
            )}
            <Button
              variant="outline"
              onClick={copyYaml}
            >
              <Copy className="w-4 h-4 mr-2" />
              {copiedFormat === 'YAML' ? 'Copied!' : 'Copy YAML'}
            </Button>
            <Button
              variant="outline"
              onClick={copyDebugJson}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy JSON
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadGarminUsbFit}
              disabled={isDownloadingFit}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              {isDownloadingFit ? 'Downloading…' : 'Download'}
            </Button>
            <Button
              onClick={() => sendToDevice(deviceExport.deviceName)}
              className="flex-1"
            >
              <Send className="w-4 h-4 mr-2" />
              Sync to {deviceExport.deviceName}
            </Button>
            {hasGarminUsb && (
              <Button
                variant="secondary"
                onClick={handleDownloadGarminUsbFit}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download FIT for Garmin (USB)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trainer Distribution */}
      {userMode === 'trainer' && (
        <TrainerDistribution workoutTitle={sources[0]?.split(':')[1] || 'Workout'} />
      )}

      {/* Workout Scheduling */}
      {supportsScheduling && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Schedule Workout
                </CardTitle>
                <CardDescription>
                  Add this workout to your {deviceExport.deviceName} calendar
                  {selectedDevice === 'garmin' && ' or TrainingPeaks'}
                </CardDescription>
              </div>
              {scheduledDates.length > 0 && (
                <Badge variant="secondary">
                  {scheduledDates.length} scheduled
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      {selectedDate ? formatDate(selectedDate) : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Recurring</Label>
                <Select value={recurringType} onValueChange={(value: any) => setRecurringType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">One-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {recurringType !== 'none' && (
              <div className="space-y-2">
                <Label>Number of occurrences</Label>
                <Select 
                  value={recurringCount.toString()} 
                  onValueChange={(value) => setRecurringCount(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6, 7, 8, 10, 12].map(num => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} times
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={addScheduledDate}
              disabled={!selectedDate}
              className="w-full"
              variant="outline"
            >
              <CalendarPlus className="w-4 h-4 mr-2" />
              Add to Schedule
            </Button>

            {scheduledDates.length > 0 && (
              <div className="space-y-2">
                <Label>Scheduled Dates ({scheduledDates.length})</Label>
                <ScrollArea className="h-32 w-full rounded-md border p-2">
                  <div className="space-y-2">
                    {scheduledDates
                      .sort((a, b) => a.getTime() - b.getTime())
                      .map((date, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                        >
                          <span>{formatDate(date)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeScheduledDate(idx)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </ScrollArea>

                <Button
                  onClick={syncWithSchedule}
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Sync {scheduledDates.length} Workout{scheduledDates.length > 1 ? 's' : ''} to Calendar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Provenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Workout Provenance
          </CardTitle>
          <CardDescription>
            Original sources used to create this workout
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sources.map((source, idx) => (
              <div key={idx} className="p-3 bg-muted rounded-lg text-sm break-all">
                {source}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Start New Workout */}
      {onStartNew && (
        <div className="flex justify-center pt-4 pb-8">
          <Button
            size="lg"
            variant="outline"
            onClick={onStartNew}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Start New Workout
          </Button>
        </div>
      )}

      {/* Workout Selector Dialog */}
      <Dialog open={showWorkoutSelector} onOpenChange={setShowWorkoutSelector}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Select Saved Workout</DialogTitle>
            <DialogDescription>
              Choose a saved workout to sync to your {deviceExport.deviceName} device
            </DialogDescription>
          </DialogHeader>
          <WorkoutSelector
            selectedDevice={selectedDevice}
            onSelectWorkout={handleSelectSavedWorkout}
            onClose={() => setShowWorkoutSelector(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}