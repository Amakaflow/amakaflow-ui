import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Dumbbell,
  Settings,
  ChevronRight,
  ArrowLeft,
  BarChart3,
  Users,
  Activity,
  CalendarDays,
  Plus,
  Layers,
  HelpCircle,
  TrendingUp,
  FolderOpen,
  Sparkles,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { AddSources, Source } from '../components/AddSources';
import { StructureWorkout } from '../components/StructureWorkout';
import { ValidateMap } from '../components/ValidateMap';
import { PublishExport } from '../components/PublishExport';
import { TeamSharing } from '../components/TeamSharing';
import { WelcomeGuide } from '../components/WelcomeGuide';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { WorkoutTypeConfirmDialog } from '../components/WorkoutTypeConfirmDialog';
import { PinterestBulkImportModal } from '../components/PinterestBulkImportModal';
import {
  Analytics,
  UserSettings,
  StravaEnhance,
  Calendar,
  UnifiedWorkouts,
  MobileCompanion,
  ImportScreen,
  HelpPage,
  ExerciseHistory,
  VolumeAnalytics,
  ProgramDetail,
  ProgramsList,
  CreateAIWorkout,
} from './router';
import type { View } from './router';
import type { AppUser } from './useAppAuth';
import { WorkoutStructure, ExportFormats, ValidationResponse, WorkoutType } from '../types/workout';
import {
  generateWorkoutStructure as generateWorkoutStructureReal,
  checkApiHealth,
  normalizeWorkoutStructure,
} from '../lib/api';
import { generateWorkoutStructure as generateWorkoutStructureMock } from '../lib/mock-api';
import {
  validateWorkoutMapping,
  processWorkoutWithValidation,
  exportWorkoutToDevice,
  checkMapperApiHealth,
} from '../lib/mapper-api';
import { DeviceId, getDeviceById } from '../lib/devices';
import { saveWorkoutToHistory, getWorkoutHistory } from '../lib/workout-history';
import { applyWorkoutTypeDefaults } from '../lib/workoutTypeDefaults';
import { isDemoMode } from '../lib/demo-mode';
import { isAccountConnected } from '../lib/linked-accounts';
import { setCurrentProfileId } from '../lib/workout-history';

type WorkflowStep = 'add-sources' | 'structure' | 'validate' | 'export';

export interface WorkflowViewProps {
  user: AppUser;
  selectedDevice: DeviceId;
  setSelectedDevice: (d: DeviceId) => void;
  workoutHistoryList: any[];
  refreshHistory: () => Promise<void>;
  onNavigate: (view: View) => void;
  currentView: View;
  setCurrentView: (v: View) => void;
  stravaConnected: boolean;
}

export function WorkflowView({
  user,
  selectedDevice,
  setSelectedDevice,
  workoutHistoryList,
  refreshHistory,
  onNavigate,
  currentView,
  setCurrentView,
  stravaConnected,
}: WorkflowViewProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('add-sources');
  const [showStravaEnhance, setShowStravaEnhance] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [workout, setWorkout] = useState<WorkoutStructure | null>(null);
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [exports, setExports] = useState<ExportFormats | null>(null);
  const [loading, setLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [generationAbortController, setGenerationAbortController] = useState<AbortController | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [isEditingFromHistory, setIsEditingFromHistory] = useState(false);
  const [isCreatingFromScratch, setIsCreatingFromScratch] = useState(false);
  const [isEditingFromImport, setIsEditingFromImport] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [workoutSaved, setWorkoutSaved] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [pinterestBulkModal, setPinterestBulkModal] = useState<{
    open: boolean;
    workouts: WorkoutStructure[];
    originalTitle: string;
    sourceUrl: string;
  }>({
    open: false,
    workouts: [],
    originalTitle: '',
    sourceUrl: '',
  });
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
  const [workoutTypeDialog, setWorkoutTypeDialog] = useState<{
    open: boolean;
    detectedType: WorkoutType;
    confidence: number;
    pendingWorkout: WorkoutStructure | null;
  }>({
    open: false,
    detectedType: 'mixed',
    confidence: 0,
    pendingWorkout: null,
  });

  // Build timestamp - shows when app was loaded/updated
  const [buildTimestamp] = useState(() => new Date().toISOString());

  const steps: Array<{ id: WorkflowStep; label: string; number: number }> = [
    { id: 'add-sources', label: 'Add Sources', number: 1 },
    { id: 'structure', label: 'Structure Workout', number: 2 },
    { id: 'validate', label: 'Validate & Map', number: 3 },
    { id: 'export', label: 'Publish & Export', number: 4 },
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

  // Sync selectedDevice when user.selectedDevices changes
  useEffect(() => {
    if (user && user.selectedDevices && user.selectedDevices.length > 0) {
      if (!user.selectedDevices.includes(selectedDevice)) {
        setSelectedDevice(user.selectedDevices[0]);
      }
    }
  }, [user?.selectedDevices]);

  // ─── Handler functions ────────────────────────────────────────────────────

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

    const loadingToast = toast.loading(
      'Generating workout structure... This may take a minute for complex images.',
      { id: 'generate-structure' }
    );

    // Progress update interval
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (!prev) return 'Processing...';
        const messages = [
          'Extracting text from image...',
          'Processing OCR data...',
          'Parsing workout structure...',
          'Validating exercises...',
          'Finalizing structure...',
        ];
        const currentIndex = messages.findIndex(m => prev.includes(m.split('...')[0]));
        const nextIndex =
          currentIndex >= 0 && currentIndex < messages.length - 1 ? currentIndex + 1 : 0;
        return messages[nextIndex];
      });
    }, 10000);

    try {
      setGenerationProgress('Checking API availability...');
      let isApiAvailable = apiAvailable;
      if (isApiAvailable === null || isApiAvailable === false) {
        try {
          isApiAvailable = await checkApiHealth();
        } catch {
          isApiAvailable = false;
        }
      }

      setApiAvailable(isApiAvailable);

      if (abortController.signal.aborted) {
        throw new Error('Generation cancelled');
      }

      setGenerationProgress('Preparing sources...');
      const sourcesData = newSources.map(s => ({ type: s.type, content: s.content }));

      let structure: WorkoutStructure;
      if (isApiAvailable) {
        try {
          setGenerationProgress('Sending request to API...');
          structure = await generateWorkoutStructureReal(sourcesData, abortController.signal);
        } catch (apiError: any) {
          if (apiError.name === 'AbortError' || abortController.signal.aborted) {
            throw new Error('Generation cancelled');
          }
          throw new Error(`API error: ${apiError.message || 'Failed to generate workout'}`);
        }
      } else {
        structure = await generateWorkoutStructureMock(sourcesData);
      }

      if (abortController.signal.aborted) {
        throw new Error('Generation cancelled');
      }

      setGenerationProgress('Analyzing quality...');

      const usedVisionAPI = (structure as any)?._usedVisionAPI === true;
      const sourceIsImage = newSources.some(s => s.type === 'image');

      const { getImageProcessingMethod } = await import('../lib/preferences');
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
        totalExercises: structure?.blocks?.reduce(
          (sum, b) =>
            sum +
            (b.exercises?.length || 0) +
            (b.supersets?.reduce((s, ss) => s + (ss.exercises?.length || 0), 0) || 0),
          0
        ),
      });

      if (!actuallyUsedVision && structure && sourceIsImage) {
        const { analyzeOCRQuality } = await import('../lib/ocr-quality');
        const quality = analyzeOCRQuality(structure, actuallyUsedVision);
        console.log('OCR Quality Result:', quality);
        console.log('OCR Quality Details:', {
          score: quality?.score,
          recommendation: quality?.recommendation,
          totalExercises: quality
            ? (structure.blocks || []).reduce(
                (sum: number, b: any) =>
                  sum +
                  (b.exercises?.length || 0) +
                  (b.supersets?.reduce(
                    (s: number, ss: any) => s + (ss.exercises?.length || 0),
                    0
                  ) || 0),
                0
              )
            : 0,
          issues: quality?.issues,
          issuesCount: quality?.issues?.length,
        });

        const shouldBlock =
          quality && (quality.recommendation === 'poor' || quality.score < 40);
        console.log('Should block progression?', shouldBlock, {
          score: quality?.score,
          recommendation: quality?.recommendation,
          scoreCheck: quality?.score < 40,
          recommendationCheck: quality?.recommendation === 'poor',
          issues: quality?.issues?.length,
          qualityExists: !!quality,
        });

        if (shouldBlock) {
          console.log(
            'BLOCKING progression due to poor OCR quality:',
            quality.score,
            quality.recommendation
          );

          clearInterval(progressInterval);
          setLoading(false);
          setGenerationProgress(null);
          setGenerationAbortController(null);

          setCurrentStep('add-sources');

          toast.dismiss('generate-structure');

          toast.error(
            <div className="space-y-3">
              <div className="font-semibold">OCR Quality Too Low: {quality.score}%</div>
              <div className="text-sm">
                This image is too complex for OCR. Please switch to the{' '}
                <strong>AI Vision Model</strong> for better accuracy.
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    const { setImageProcessingMethod } = await import('../lib/preferences');
                    setImageProcessingMethod('vision');
                    toast.success('Switched to Vision API. Please try again.');
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
          console.log('RETURNING EARLY - NOT setting workout or changing step');
          return;
        }
      }

      console.log('OCR quality acceptable or Vision API used, proceeding to structure page');

      setGenerationProgress('Complete!');

      // AMA-213: Check for workout type detection
      const detectedType = structure.workout_type as WorkoutType | undefined;
      const typeConfidence = structure.workout_type_confidence ?? 0;

      console.log('[AMA-213] Workout type detection:', { detectedType, typeConfidence });

      // Check for bulk workouts (Pinterest multi-day plans, boards)
      const bulkWorkouts = structure._bulkWorkouts;
      if (bulkWorkouts && bulkWorkouts.length > 1) {
        const originalTitle =
          (structure._provenance?.original_title as string) || structure.title;
        const workoutLabels =
          (structure._provenance?.workout_labels as string[]) || [];

        console.log(`[Bulk Import] Detected ${bulkWorkouts.length} workouts:`, workoutLabels);

        clearInterval(progressInterval);
        setLoading(false);
        setGenerationProgress(null);
        setGenerationAbortController(null);
        toast.dismiss('generate-structure');

        toast.error(
          `"${originalTitle}" contains ${bulkWorkouts.length} separate workouts (${workoutLabels
            .slice(0, 3)
            .join(', ')}${workoutLabels.length > 3 ? '...' : ''}). Please use Import to import all workouts at once.`,
          {
            duration: 15000,
            id: 'pinterest-bulk-error',
            action: {
              label: 'Go to Import',
              onClick: () => {
                clearWorkflowState();
                setCurrentView('import');
                toast.info(
                  `Paste your Pinterest URL in Import to import all ${bulkWorkouts.length} workouts.`
                );
              },
            },
          }
        );

        return;
      }

      // AMA-213: Handle workout type detection
      if (detectedType && typeConfidence > 0) {
        if (typeConfidence >= 0.9) {
          console.log('[AMA-213] High confidence, auto-applying defaults for:', detectedType);
          const workoutWithDefaults = applyWorkoutTypeDefaults(structure, detectedType);
          setWorkout(workoutWithDefaults);
          setSources(newSources);
          setCurrentStep('structure');
          setWorkoutSaved(false);
          clearInterval(progressInterval);
          setLoading(false);
          setGenerationProgress(null);
          setGenerationAbortController(null);
          toast.dismiss('generate-structure');
          toast.success(
            `Workout structure generated! (${detectedType} workout - settings applied)`
          );
          return;
        } else {
          console.log(
            '[AMA-213] Lower confidence, showing dialog for:',
            detectedType,
            typeConfidence
          );
          clearInterval(progressInterval);
          setLoading(false);
          setGenerationProgress(null);
          setGenerationAbortController(null);
          toast.dismiss('generate-structure');

          setWorkoutTypeDialog({
            open: true,
            detectedType: detectedType,
            confidence: typeConfidence,
            pendingWorkout: structure,
          });
          setSources(newSources);
          return;
        }
      }

      // No workout type detected - proceed without defaults
      setWorkout(structure);
      setSources(newSources);
      setCurrentStep('structure');
      setWorkoutSaved(false);
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

  // AMA-213: Handle workout type confirmation dialog
  const handleWorkoutTypeConfirm = (selectedType: WorkoutType, applyDefaults: boolean) => {
    const pendingWorkout = workoutTypeDialog.pendingWorkout;
    if (!pendingWorkout) return;

    let finalWorkout: WorkoutStructure;
    if (applyDefaults) {
      finalWorkout = applyWorkoutTypeDefaults(pendingWorkout, selectedType);
      toast.success(`Workout type set to ${selectedType}. Settings applied!`);
    } else {
      finalWorkout = {
        ...pendingWorkout,
        workout_type: selectedType,
      };
      toast.success('Workout structure generated!');
    }

    setWorkout(finalWorkout);
    setCurrentStep('structure');
    setWorkoutSaved(false);
    setWorkoutTypeDialog({
      open: false,
      detectedType: 'mixed',
      confidence: 0,
      pendingWorkout: null,
    });
  };

  const handleWorkoutTypeSkip = () => {
    const pendingWorkout = workoutTypeDialog.pendingWorkout;
    if (!pendingWorkout) return;

    setWorkout(pendingWorkout);
    setCurrentStep('structure');
    setWorkoutSaved(false);
    setWorkoutTypeDialog({
      open: false,
      detectedType: 'mixed',
      confidence: 0,
      pendingWorkout: null,
    });
    toast.success('Workout structure generated!');
  };

  // Pinterest bulk import handlers
  const handlePinterestBulkImport = async (workouts: WorkoutStructure[]) => {
    const { saveWorkoutToAPI } = await import('../lib/workout-api');
    const profileId = user?.id || 'dev-user';

    for (const w of workouts) {
      try {
        const normalized = normalizeWorkoutStructure(w);
        await saveWorkoutToAPI({
          profile_id: profileId,
          workout_data: normalized,
          sources: [w.source || pinterestBulkModal.sourceUrl],
          device: selectedDevice,
          title: w.title,
        });
      } catch (error) {
        console.error('Failed to save workout:', w.title, error);
        throw error;
      }
    }

    const history = await getWorkoutHistory();
    // refreshHistory will pull from the API; we call it to keep parent in sync
    await refreshHistory();
  };

  const handlePinterestEditSingle = (w: WorkoutStructure) => {
    const normalized = normalizeWorkoutStructure(w);
    setWorkout(normalized);
    setSources([]);
    setCurrentStep('structure');
    setWorkoutSaved(false);
    setIsCreatingFromScratch(false);
    setIsEditingFromHistory(false);
    toast.success(`Editing: ${w.title}`);
  };

  const handlePinterestBulkClose = () => {
    setPinterestBulkModal({
      open: false,
      workouts: [],
      originalTitle: '',
      sourceUrl: '',
    });
  };

  const handleLoadTemplate = (template: WorkoutStructure) => {
    setWorkout(template);
    setSources([]);
    setCurrentStep('structure');
    setWorkoutSaved(false);
    setIsCreatingFromScratch(false);
    setIsEditingFromHistory(false);
    toast.success(`Loaded template: ${template.title}`);
  };

  const handleCreateNew = async () => {
    try {
      const { createEmptyWorkout } = await import('../lib/api');
      const emptyWorkout = await createEmptyWorkout();
      setWorkout(emptyWorkout);
      setSources([]);
      setCurrentStep('structure');
      setWorkoutSaved(false);
      setIsCreatingFromScratch(true);
      setIsEditingFromHistory(false);
      toast.success('Created new workout. Start building your workout structure!');
    } catch (error: any) {
      console.error('Failed to create empty workout:', error);
      toast.error('Failed to create workout. Please try again.');
    }
  };

  const handleAutoMap = async () => {
    if (!workout) return;
    setLoading(true);
    try {
      const isMapperApiAvailable = await checkMapperApiHealth();

      if (isMapperApiAvailable) {
        const validationResult = await validateWorkoutMapping(workout);
        setValidation(validationResult);
        const exportFormats = await exportWorkoutToDevice(
          workout,
          selectedDevice,
          validationResult
        );
        setExports(exportFormats);
      } else {
        const { processWorkflow } = await import('../lib/mock-api');
        const exportFormats = await processWorkflow(workout, true);
        setExports(exportFormats);
      }

      if (user) {
        await saveWorkoutToHistory(
          user.id,
          workout,
          selectedDevice,
          exports,
          sources.map((s: Source) => `${s.type}:${s.content}`),
          undefined,
          editingWorkoutId || undefined
        );
        setWorkoutSaved(true);
      }

      setCurrentStep('export');
      toast.success('Workout auto-mapped and ready to export!');

      if (user) {
        const history = await getWorkoutHistory(user.id);
        await refreshHistory();
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

    if (validation) {
      const hasAllValidated = validation.validated_exercises?.length > 0;
      const hasNeedsReview = (validation.needs_review?.length || 0) > 0;
      const hasUnmapped = (validation.unmapped_exercises?.length || 0) > 0;

      if (hasAllValidated && !hasNeedsReview && !hasUnmapped) {
        console.log('Using existing validation data (workout already has complete Garmin mappings)');
        setCurrentStep('validate');
        toast.success('Loaded saved Garmin mappings');
        return;
      }
    }

    setLoading(true);
    try {
      console.log('Starting validation...');
      const isMapperApiAvailable = await checkMapperApiHealth();
      console.log('Mapper API available:', isMapperApiAvailable);

      let validationResult: ValidationResponse;
      if (isMapperApiAvailable) {
        console.log('Calling mapper API for validation...');
        validationResult = await validateWorkoutMapping(workout);
        console.log('Validation result:', validationResult);
      } else {
        console.log('Mapper API unavailable, using mock validation');
        const { validateWorkout } = await import('../lib/mock-api');
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
      const isMapperApiAvailable = await checkMapperApiHealth();

      let validationResult: ValidationResponse;
      if (isMapperApiAvailable) {
        validationResult = await validateWorkoutMapping(updatedWorkout);
      } else {
        const { validateWorkout } = await import('../lib/mock-api');
        validationResult = await validateWorkout(updatedWorkout);
      }

      setValidation(validationResult);
      setWorkout(updatedWorkout);
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
      const isMapperApiAvailable = await checkMapperApiHealth();

      let exportFormats: ExportFormats;
      let validationResult: ValidationResponse | null = null;

      if (isMapperApiAvailable) {
        const processResult = await processWorkoutWithValidation(updatedWorkout, false);
        validationResult = processResult.validation;

        if (processResult.validation.can_proceed || processResult.yaml) {
          try {
            exportFormats = await exportWorkoutToDevice(
              updatedWorkout,
              selectedDevice,
              validationResult
            );
            if (!exportFormats.yaml && processResult.yaml) {
              exportFormats.yaml = processResult.yaml;
            }
          } catch (deviceError) {
            exportFormats = { yaml: processResult.yaml || '' };
          }
        } else {
          exportFormats = { yaml: processResult.yaml || '' };
        }
      } else {
        const { processWorkflow } = await import('../lib/mock-api');
        exportFormats = await processWorkflow(updatedWorkout, false);
      }

      setExports(exportFormats);
      setValidation(validationResult);
      setWorkout(updatedWorkout);
      setCurrentStep('export');
      const deviceName = getDeviceById(selectedDevice)?.name || selectedDevice;
      toast.success(`Workout processed for ${deviceName}!`);

      if (user) {
        const sourcesAsStrings = sources.map((s: Source) => `${s.type}:${s.content}`);
        await saveWorkoutToHistory(
          user.id,
          updatedWorkout,
          selectedDevice,
          exportFormats,
          sourcesAsStrings,
          validationResult,
          editingWorkoutId || undefined
        );
        setWorkoutSaved(true);
        try {
          await refreshHistory();
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
    setSources(
      historyItem.sources.map((s: string) => {
        const [type, ...content] = s.split(':');
        return { id: Math.random().toString(), type, content: content.join(':') };
      })
    );
    setSelectedDevice(historyItem.device);
    setValidation(historyItem.validation || null);
    setExports(historyItem.exports || null);
    setIsEditingFromHistory(true);
    setEditingWorkoutId(historyItem.id);

    setCurrentStep('export');
    setCurrentView('workflow');
    setWorkoutSaved(true);
    toast.success('Workout loaded');
  };

  const handleEditFromHistory = (historyItem: any) => {
    const normalizedWorkout = normalizeWorkoutStructure(historyItem.workout);

    setWorkout(normalizedWorkout);
    setSources(
      historyItem.sources.map((s: string) => {
        const [type, ...content] = s.split(':');
        return { id: Math.random().toString(), type, content: content.join(':') };
      })
    );
    setSelectedDevice(historyItem.device);
    setValidation(historyItem.validation || null);
    setExports(historyItem.exports || null);
    setCurrentStep('structure');
    setCurrentView('workflow');
    setIsEditingFromHistory(true);
    setEditingWorkoutId(historyItem.id);
    setWorkoutSaved(true);
    toast.success('Workout opened for editing - you can edit directly or re-validate if needed');
  };

  const handleBulkDeleteWorkouts = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;

    const profileId = user?.id;
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const id of ids) {
      try {
        const { deleteWorkoutFromHistory } = await import('../lib/workout-history');
        const ok = await deleteWorkoutFromHistory(id, profileId);
        if (ok) {
          succeeded.push(id);
        } else {
          failed.push(id);
        }
      } catch (error) {
        console.error(`Error deleting workout ${id}:`, error);
        failed.push(id);
      }
    }

    if (succeeded.length > 0) {
      await refreshHistory();
    }

    if (failed.length > 0 && succeeded.length > 0) {
      toast.warning(
        `Deleted ${succeeded.length} workout(s). Failed to delete ${failed.length}.`
      );
    } else if (failed.length > 0) {
      toast.error(`Failed to delete ${failed.length} workout(s).`);
    } else {
      toast.success(`Deleted ${ids.length} workout(s).`);
    }
  };

  // Helper function to check for unsaved changes and show confirmation
  const checkUnsavedChanges = (onConfirm: () => void): void => {
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
    setIsCreatingFromScratch(false);
    setIsEditingFromImport(false);
    setEditingWorkoutId(null);
    setWorkoutSaved(false);
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
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
      checkUnsavedChanges(() => {
        setCurrentView('home');
        clearWorkflowState();
      });
    }
  };

  // ─── JSX ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Workflow Header (only shown in workflow view) */}
      {currentView === 'workflow' && (
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-6">
            <div className="mb-6">
              <h1 className="text-2xl">
                {isEditingFromImport
                  ? 'Review Imported Workout'
                  : isEditingFromHistory
                  ? 'Edit Workout'
                  : 'Create Workout'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isEditingFromImport
                  ? 'Review and adjust your imported workout before saving'
                  : isEditingFromHistory
                  ? 'Edit your workout directly or re-validate if needed'
                  : 'Ingest \u2192 Structure \u2192 Validate \u2192 Export'}
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
      <div
        id="main-content"
        role="main"
        data-assistant-target="main-content"
        className={`container mx-auto px-4 py-8 ${
          currentView === 'workflow' && workout ? 'pb-32' : ''
        }`}
      >
        {/* Welcome Guide (shown on home view) */}
        {currentView === 'home' && (
          <>
            <WelcomeGuide
              onGetStarted={() => {
                setCurrentView('workflow');
                setCurrentStep('add-sources');
              }}
            />
            {/* Version timestamp — dev only */}
            {!isDemoMode && (
              <div className="mt-8 text-center">
                <p className="text-xs text-muted-foreground">
                  Build: {new Date(buildTimestamp).toLocaleString()}
                </p>
              </div>
            )}
          </>
        )}

        {currentView === 'workflow' && currentStepIndex > 0 && !isEditingFromHistory && (
          <Button variant="ghost" onClick={handleBack} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}
        {currentView === 'workflow' && isEditingFromHistory && (
          <Button
            variant="ghost"
            onClick={() => {
              const destination = isEditingFromImport ? 'import' : 'workouts';
              if (workout && !workoutSaved) {
                setConfirmDialog({
                  open: true,
                  title: 'Unsaved Changes',
                  description:
                    'Are you sure you want to go back? Any unsaved changes will be lost.',
                  onConfirm: () => {
                    setCurrentView(destination as View);
                    setIsEditingFromHistory(false);
                    setIsEditingFromImport(false);
                    setEditingWorkoutId(null);
                  },
                });
                return;
              }
              setCurrentView(destination as View);
              setIsEditingFromHistory(false);
              setIsEditingFromImport(false);
              setEditingWorkoutId(null);
            }}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isEditingFromImport ? 'Back to Import' : 'Back to History'}
          </Button>
        )}

        {currentView === 'workflow' && currentStep === 'add-sources' && (
          <AddSources
            onGenerate={handleGenerateStructure}
            progress={generationProgress}
            onCancel={handleCancelGeneration}
            onLoadTemplate={handleLoadTemplate}
            onCreateNew={handleCreateNew}
            loading={loading}
          />
        )}

        {currentView === 'workflow' && currentStep === 'structure' && workout && (
          <div data-assistant-target="workout-log">
            <StructureWorkout
              workout={workout}
              onWorkoutChange={updatedWorkout => {
                setWorkout(updatedWorkout);
                setWorkoutSaved(false);
              }}
              onAutoMap={handleAutoMap}
              onValidate={handleValidate}
              onSave={
                isEditingFromHistory || isCreatingFromScratch
                  ? async () => {
                      if (!user?.id || !workout) return;
                      setLoading(true);
                      try {
                        const { saveWorkoutToHistory } = await import('../lib/workout-history');
                        await saveWorkoutToHistory(
                          user.id,
                          workout,
                          selectedDevice,
                          exports || undefined,
                          sources.map(s => `${s.type}:${s.content}`),
                          validation || undefined,
                          editingWorkoutId || undefined
                        );
                        toast.success('Workout saved!');
                        setWorkoutSaved(true);
                        const { getWorkoutHistory } = await import('../lib/workout-history');
                        await refreshHistory();
                        if (isEditingFromHistory) {
                          setCurrentView('workouts');
                          setIsEditingFromHistory(false);
                          setEditingWorkoutId(null);
                        } else if (isCreatingFromScratch) {
                          setIsCreatingFromScratch(false);
                        }
                      } catch (error: any) {
                        toast.error(`Failed to save workout: ${error.message}`);
                      } finally {
                        setLoading(false);
                      }
                    }
                  : undefined
              }
              isEditingFromHistory={isEditingFromHistory}
              isCreatingFromScratch={isCreatingFromScratch}
              hideExport={isEditingFromImport}
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
          </div>
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
          <StravaEnhance onClose={() => setShowStravaEnhance(false)} />
        )}

        {currentView === 'analytics' &&
          (user ? (
            <Analytics user={user} history={workoutHistoryList} />
          ) : (
            <div className="text-center py-16">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
              <h3 className="text-xl mb-2">Analytics</h3>
              <p className="text-muted-foreground">Please sign in to view analytics</p>
            </div>
          ))}

        {currentView === 'exercise-history' && user && (
          <div data-assistant-target="workout-history">
            <ExerciseHistory user={user} />
          </div>
        )}

        {currentView === 'volume-analytics' && user && <VolumeAnalytics user={user} />}

        {currentView === 'team' && (
          <TeamSharing user={user} currentWorkout={workout} />
        )}

        {currentView === 'settings' && (
          <div data-assistant-target="preferences-panel">
            <UserSettings
              user={user}
              onBack={() => setCurrentView('workflow')}
              onAccountsChange={async () => {
                // stravaConnected state lives in parent (useAppAuth); no-op here in Phase 1
              }}
              onAccountDeleted={() => {
                setCurrentProfileId(null);
                setCurrentView('home');
              }}
              onUserUpdate={updates => {
                // User state lives in parent; nothing to do locally
                // selectedDevice sync handled by the useEffect above
                if (updates.selectedDevices) {
                  if (
                    updates.selectedDevices.length > 0 &&
                    !updates.selectedDevices.includes(selectedDevice)
                  ) {
                    setSelectedDevice(updates.selectedDevices[0]);
                  }
                }
              }}
              onNavigateToMobileCompanion={() => setCurrentView('mobile-companion')}
            />
          </div>
        )}

        {currentView === 'help' && <HelpPage onBack={() => setCurrentView('home')} />}

        {currentView === 'strava-enhance' && (
          <StravaEnhance onClose={() => setCurrentView('workflow')} />
        )}

        {currentView === 'calendar' && (
          <div data-assistant-target="calendar-section">
            <Calendar
              userId={user.id}
              userLocation={{
                address: user.address,
                city: user.city,
                state: user.state,
                zipCode: user.zipCode,
              }}
            />
          </div>
        )}

        {currentView === 'workouts' && (
          <div data-assistant-target="workout-list">
            <UnifiedWorkouts
              profileId={user.id}
              onEditWorkout={item => {
                const normalizedWorkout = normalizeWorkoutStructure(item.workout);
                setWorkout(normalizedWorkout);
                setValidation(item.validation || null);
                setExports(item.exports || null);
                setSources(item.sources || []);
                setSelectedDevice(item.device as any);
                setIsEditingFromHistory(true);
                setEditingWorkoutId(item.id);
                setWorkoutSaved(true);
                setCurrentView('workflow');
                setCurrentStep('structure');
              }}
              onLoadWorkout={item => {
                const normalizedWorkout = normalizeWorkoutStructure(item.workout);
                setWorkout(normalizedWorkout);
                setValidation(item.validation || null);
                setExports(item.exports || null);
                setSources(item.sources || []);
                setSelectedDevice(item.device as any);
                setIsEditingFromHistory(true);
                setEditingWorkoutId(item.id);
                setCurrentView('workflow');

                if (item.exports) {
                  setCurrentStep('export');
                } else {
                  setCurrentStep('structure');
                  toast.info(
                    'This workout needs validation before export. Click "Validate Mapping" to proceed.'
                  );
                }
              }}
              onDeleteWorkout={id => {
                console.log('Workout deleted:', id);
              }}
              onViewProgram={programId => {
                setSelectedProgramId(programId);
                setCurrentView('program-detail');
              }}
            />
          </div>
        )}

        {currentView === 'programs' && (
          <div data-assistant-target="workout-plan">
            <ProgramsList
              userId={user.id}
              onViewProgram={programId => {
                setSelectedProgramId(programId);
                setCurrentView('program-detail');
              }}
            />
          </div>
        )}

        {currentView === 'create-ai' && (
          <div data-assistant-target="workout-preview">
            <CreateAIWorkout />
          </div>
        )}

        {currentView === 'mobile-companion' && (
          <MobileCompanion userId={user.id} onBack={() => setCurrentView('settings')} />
        )}

        {currentView === 'import' && (
          <ImportScreen
            userId={user.id}
            onDone={() => setCurrentView('workouts')}
            onEditWorkout={rawWorkout => {
              const normalizedWorkout = normalizeWorkoutStructure(rawWorkout);
              setWorkout(normalizedWorkout);
              setValidation(null);
              setExports(null);
              setSources([]);
              setIsEditingFromHistory(true);
              setIsEditingFromImport(true);
              setEditingWorkoutId(null);
              setWorkoutSaved(false);
              setCurrentView('workflow');
              setCurrentStep('structure');
            }}
          />
        )}

        {currentView === 'program-detail' && selectedProgramId && (
          <ProgramDetail
            programId={selectedProgramId}
            userId={user.id}
            onBack={() => {
              setSelectedProgramId(null);
              setCurrentView('workouts');
            }}
            onDeleted={() => {
              setSelectedProgramId(null);
              setCurrentView('workouts');
            }}
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
                <span className="text-muted-foreground">{workout.blocks.length} block(s)</span>
                <span className="text-muted-foreground">
                  {workout.blocks.reduce(
                    (sum, block) =>
                      sum +
                      (block.exercises?.length || 0) +
                      (block.supersets?.reduce(
                        (s, ss) => s + (ss.exercises?.length || 0),
                        0
                      ) || 0),
                    0
                  )}{' '}
                  exercise(s)
                </span>
              </div>
              {validation && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-green-600">
                    &#x2713; {validation.validated_exercises.length} validated
                  </span>
                  <span className="text-orange-600">
                    &#x26A0; {validation.needs_review.length} review
                  </span>
                  <span className="text-red-600">
                    &#x2717; {validation.unmapped_exercises.length} unmapped
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
        onOpenChange={open => setConfirmDialog({ ...confirmDialog, open })}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        confirmText="Continue"
        cancelText="Cancel"
      />

      {/* AMA-213: Workout Type Confirmation Dialog */}
      <WorkoutTypeConfirmDialog
        open={workoutTypeDialog.open}
        detectedType={workoutTypeDialog.detectedType}
        confidence={workoutTypeDialog.confidence}
        onConfirm={handleWorkoutTypeConfirm}
        onSkip={handleWorkoutTypeSkip}
      />

      {/* Pinterest Bulk Import Modal */}
      <PinterestBulkImportModal
        open={pinterestBulkModal.open}
        onClose={handlePinterestBulkClose}
        workouts={pinterestBulkModal.workouts}
        originalTitle={pinterestBulkModal.originalTitle}
        sourceUrl={pinterestBulkModal.sourceUrl}
        onImportSelected={handlePinterestBulkImport}
        onEditSingle={handlePinterestEditSingle}
      />
    </>
  );
}
