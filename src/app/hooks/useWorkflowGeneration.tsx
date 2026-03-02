import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import {
  generateWorkoutStructure as generateWorkoutStructureReal,
  checkApiHealth,
  normalizeWorkoutStructure,
} from '../../lib/api';
import { generateWorkoutStructure as generateWorkoutStructureMock } from '../../lib/mock-api';
import { applyWorkoutTypeDefaults } from '../../lib/workoutTypeDefaults';
import type { WorkoutStructure, WorkoutType } from '../../types/workout';
import type { Source } from '../../components/AddSources';
import type { View } from '../router';
import type { DeviceId } from '../../lib/devices';

type WorkflowStep = 'add-sources' | 'structure' | 'validate' | 'export';

interface PinterestBulkModalState {
  open: boolean;
  workouts: WorkoutStructure[];
  originalTitle: string;
  sourceUrl: string;
}

export interface UseWorkflowGenerationProps {
  userId: string;
  selectedDevice: DeviceId;
  refreshHistory: () => Promise<void>;
  onWorkoutGenerated: (workout: WorkoutStructure, sources: Source[]) => void;
  onWorkoutTypePending: (
    workout: WorkoutStructure,
    type: WorkoutType,
    confidence: number,
    sources: Source[]
  ) => void;
  onWorkoutSaved: (saved: boolean) => void;
  onStepChange: (step: WorkflowStep) => void;
  onViewChange: (view: View) => void;
  onClearWorkout: () => void;
  onClearEditingFlags: () => void;
  clearWorkflowState: () => void;
}

export interface UseWorkflowGenerationResult {
  sources: Source[];
  setSources: React.Dispatch<React.SetStateAction<Source[]>>;
  loading: boolean;
  generationProgress: string | null;
  apiAvailable: boolean | null;
  showStravaEnhance: boolean;
  pinterestBulkModal: PinterestBulkModalState;
  welcomeDismissed: boolean;
  buildTimestamp: string;
  handleGenerateStructure: (newSources: Source[]) => Promise<void>;
  handleCancelGeneration: () => void;
  handlePinterestBulkImport: (workouts: WorkoutStructure[]) => Promise<void>;
  handlePinterestEditSingle: (w: WorkoutStructure) => void;
  handlePinterestBulkClose: () => void;
  handleLoadTemplate: (template: WorkoutStructure) => void;
  handleCreateNew: () => Promise<void>;
  handleStartNew: () => void;
  handleWelcomeDismiss: () => void;
}

export function useWorkflowGeneration({
  userId,
  selectedDevice,
  refreshHistory,
  onWorkoutGenerated,
  onWorkoutTypePending,
  onWorkoutSaved,
  onStepChange,
  onViewChange,
  onClearWorkout,
  onClearEditingFlags,
  clearWorkflowState,
}: UseWorkflowGenerationProps): UseWorkflowGenerationResult {
  const [welcomeDismissed, setWelcomeDismissed] = useState(
    () => localStorage.getItem('amakaflow_welcome_dismissed') === 'true'
  );
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [generationAbortController, setGenerationAbortController] =
    useState<AbortController | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [showStravaEnhance, setShowStravaEnhance] = useState(false);
  const [pinterestBulkModal, setPinterestBulkModal] = useState<PinterestBulkModalState>({
    open: false,
    workouts: [],
    originalTitle: '',
    sourceUrl: '',
  });
  const [buildTimestamp] = useState(() => new Date().toISOString());

  // Check API availability on mount
  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const available = await checkApiHealth();
        if (mounted) setApiAvailable(available);
      } catch {
        if (mounted) setApiAvailable(false);
      }
    };
    const timeoutId = setTimeout(checkHealth, 500);
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  const handleWelcomeDismiss = () => {
    localStorage.setItem('amakaflow_welcome_dismissed', 'true');
    setWelcomeDismissed(true);
  };

  const handleStartNew = () => {
    setSources([]);
    onClearWorkout();
    onStepChange('add-sources');
    onViewChange('workflow');
    onClearEditingFlags();
  };

  const handleGenerateStructure = async (newSources: Source[]): Promise<void> => {
    const abortController = new AbortController();
    setGenerationAbortController(abortController);
    setLoading(true);
    setGenerationProgress('Initializing...');

    toast.loading(
      'Generating workout structure... This may take a minute for complex images.',
      { id: 'generate-structure' }
    );

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

      if (abortController.signal.aborted) throw new Error('Generation cancelled');

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

      if (abortController.signal.aborted) throw new Error('Generation cancelled');

      setGenerationProgress('Analyzing quality...');

      const usedVisionAPI = (structure as any)?._usedVisionAPI === true;
      const sourceIsImage = newSources.some(s => s.type === 'image');
      const { getImageProcessingMethod } = await import('../../lib/preferences');
      const currentMethod = getImageProcessingMethod();
      const actuallyUsedVision = usedVisionAPI || currentMethod === 'vision';

      if (!actuallyUsedVision && structure && sourceIsImage) {
        const { analyzeOCRQuality } = await import('../../lib/ocr-quality');
        const quality = analyzeOCRQuality(structure, actuallyUsedVision);
        const shouldBlock = quality && (quality.recommendation === 'poor' || quality.score < 40);

        if (shouldBlock) {
          clearInterval(progressInterval);
          setLoading(false);
          setGenerationProgress(null);
          setGenerationAbortController(null);
          onStepChange('add-sources');
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
                    const { setImageProcessingMethod } = await import('../../lib/preferences');
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
                    clearWorkflowState();
                    onViewChange('settings');
                  }}
                >
                  Go to Settings
                </Button>
              </div>
            </div>,
            { duration: 20000, id: 'ocr-quality-block' }
          );
          return;
        }
      }

      setGenerationProgress('Complete!');

      const detectedType = structure.workout_type as WorkoutType | undefined;
      const typeConfidence = structure.workout_type_confidence ?? 0;

      // Check for bulk workouts (Pinterest multi-day plans)
      const bulkWorkouts = (structure as any)._bulkWorkouts;
      if (bulkWorkouts && bulkWorkouts.length > 1) {
        const originalTitle =
          ((structure as any)._provenance?.original_title as string) || structure.title;
        const workoutLabels = ((structure as any)._provenance?.workout_labels as string[]) || [];

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
                onViewChange('import');
                toast.info(
                  `Paste your Pinterest URL in Import to import all ${bulkWorkouts.length} workouts.`
                );
              },
            },
          }
        );
        return;
      }

      // Handle workout type detection
      if (detectedType && typeConfidence > 0) {
        if (typeConfidence >= 0.9) {
          const workoutWithDefaults = applyWorkoutTypeDefaults(structure, detectedType);
          clearInterval(progressInterval);
          setLoading(false);
          setGenerationProgress(null);
          setGenerationAbortController(null);
          toast.dismiss('generate-structure');
          onWorkoutGenerated(workoutWithDefaults, newSources);
          onStepChange('structure');
          onWorkoutSaved(false);
          toast.success(`Workout structure generated! (${detectedType} workout - settings applied)`);
          return;
        } else {
          clearInterval(progressInterval);
          setLoading(false);
          setGenerationProgress(null);
          setGenerationAbortController(null);
          toast.dismiss('generate-structure');
          onWorkoutTypePending(structure, detectedType, typeConfidence, newSources);
          return;
        }
      }

      // No workout type detected — proceed normally
      onWorkoutGenerated(structure, newSources);
      onStepChange('structure');
      onWorkoutSaved(false);
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
      } else {
        toast.error(errorMessage, {
          action: { label: 'Retry', onClick: () => handleGenerateStructure(newSources) },
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

  const handlePinterestBulkImport = async (workouts: WorkoutStructure[]): Promise<void> => {
    const { saveWorkoutToAPI } = await import('../../lib/workout-api');
    const profileId = userId;
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
    await refreshHistory();
  };

  const handlePinterestEditSingle = (w: WorkoutStructure) => {
    const normalized = normalizeWorkoutStructure(w);
    onWorkoutGenerated(normalized, []);
    onStepChange('structure');
    onWorkoutSaved(false);
    toast.success(`Editing: ${w.title}`);
  };

  const handlePinterestBulkClose = () => {
    setPinterestBulkModal({ open: false, workouts: [], originalTitle: '', sourceUrl: '' });
  };

  const handleLoadTemplate = (template: WorkoutStructure) => {
    onWorkoutGenerated(template, []);
    onStepChange('structure');
    onWorkoutSaved(false);
    toast.success(`Loaded template: ${template.title}`);
  };

  const handleCreateNew = async (): Promise<void> => {
    try {
      const { createEmptyWorkout } = await import('../../lib/api');
      const emptyWorkout = await createEmptyWorkout();
      onWorkoutGenerated(emptyWorkout, []);
      onStepChange('structure');
      onWorkoutSaved(false);
      toast.success('Created new workout. Start building your workout structure!');
    } catch (error: any) {
      console.error('Failed to create empty workout:', error);
      toast.error('Failed to create workout. Please try again.');
    }
  };

  // Suppress unused variable warning
  void showStravaEnhance;
  void setShowStravaEnhance;

  return {
    sources,
    setSources,
    loading,
    generationProgress,
    apiAvailable,
    showStravaEnhance,
    pinterestBulkModal,
    welcomeDismissed,
    buildTimestamp,
    handleGenerateStructure,
    handleCancelGeneration,
    handlePinterestBulkImport,
    handlePinterestEditSingle,
    handlePinterestBulkClose,
    handleLoadTemplate,
    handleCreateNew,
    handleStartNew,
    handleWelcomeDismiss,
  };
}
