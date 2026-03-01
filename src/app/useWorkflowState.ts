import { useState } from 'react';
import { toast } from 'sonner';
import { applyWorkoutTypeDefaults } from '../lib/workoutTypeDefaults';
import { useWorkflowGeneration } from './hooks/useWorkflowGeneration';
import { useWorkflowEditing } from './hooks/useWorkflowEditing';
import { useWorkflowValidation } from './hooks/useWorkflowValidation';
import type { WorkoutStructure, ValidationResponse, ExportFormats, WorkoutType } from '../types/workout';
import type { ProcessedItem } from '../types/import';
import type { View } from './router';
import type { AppUser } from './useAppAuth';
import type { DeviceId } from '../lib/devices';
import type React from 'react';

type WorkflowStep = 'add-sources' | 'structure' | 'validate' | 'export';

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

interface WorkoutTypeDialogState {
  open: boolean;
  detectedType: WorkoutType;
  confidence: number;
  pendingWorkout: WorkoutStructure | null;
}

export interface UseWorkflowStateProps {
  user: AppUser;
  selectedDevice: DeviceId;
  setSelectedDevice: (d: DeviceId) => void;
  refreshHistory: () => Promise<void>;
  onNavigate: (view: View) => void;
  currentView: View;
  setCurrentView: (v: View) => void;
  stravaConnected: boolean;
}

export function useWorkflowState({
  user,
  selectedDevice,
  setSelectedDevice,
  refreshHistory,
  onNavigate: _onNavigate,
  currentView,
  setCurrentView,
  stravaConnected,
}: UseWorkflowStateProps) {
  // ── Bridge state ────────────────────────────────────────────────────────────
  const [workout, setWorkout] = useState<WorkoutStructure | null>(null);
  const [workoutSaved, setWorkoutSaved] = useState(false);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('add-sources');
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [exports, setExports] = useState<ExportFormats | null>(null);
  const [importProcessedItems, setImportProcessedItems] = useState<ProcessedItem[]>([]);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });
  const [workoutTypeDialog, setWorkoutTypeDialog] = useState<WorkoutTypeDialogState>({
    open: false,
    detectedType: 'mixed',
    confidence: 0,
    pendingWorkout: null,
  });

  const steps: Array<{ id: WorkflowStep; label: string; number: number }> = [
    { id: 'add-sources', label: 'Add Sources', number: 1 },
    { id: 'structure', label: 'Structure Workout', number: 2 },
    { id: 'validate', label: 'Validate & Map', number: 3 },
    { id: 'export', label: 'Publish & Export', number: 4 },
  ];
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  // ── clearWorkflowState — uses a mutable ref object so hooks can be wired ──
  const resetRefs = { genSources: () => {}, editing: () => {} };

  const clearWorkflowState = () => {
    setWorkout(null);
    setValidation(null);
    setExports(null);
    setCurrentStep('add-sources');
    setWorkoutSaved(false);
    resetRefs.genSources();
    resetRefs.editing();
  };

  // ── Domain hooks ────────────────────────────────────────────────────────────

  const generation = useWorkflowGeneration({
    userId: user.id,
    selectedDevice,
    refreshHistory,
    onWorkoutGenerated: (w, srcs) => {
      setWorkout(w);
      generation.setSources(srcs);
    },
    onWorkoutTypePending: (w, type, confidence, srcs) => {
      generation.setSources(srcs);
      setWorkoutTypeDialog({ open: true, detectedType: type, confidence, pendingWorkout: w });
    },
    onWorkoutSaved: setWorkoutSaved,
    onStepChange: setCurrentStep,
    onViewChange: setCurrentView,
    onClearWorkout: () => {
      setWorkout(null);
      setValidation(null);
      setExports(null);
    },
    onClearEditingFlags: () => editing.reset(),
    clearWorkflowState,
  });

  const editing = useWorkflowEditing({
    userId: user.id,
    selectedDevice,
    setSelectedDevice,
    refreshHistory,
    onStepChange: setCurrentStep,
    onViewChange: setCurrentView,
    setWorkout,
    setWorkoutSaved,
    setSources: generation.setSources,
    setValidation,
    setExports,
    setConfirmDialog: setConfirmDialog as React.Dispatch<React.SetStateAction<ConfirmDialogState>>,
    workout,
    workoutSaved,
    importProcessedItems,
    setImportProcessedItems,
  });

  const validationHook = useWorkflowValidation({
    workout,
    userId: user.id,
    selectedDevice,
    user,
    sources: generation.sources,
    stravaConnected,
    editingWorkoutId: editing.editingWorkoutId,
    setWorkout: (w) => setWorkout(w),
    setWorkoutSaved,
    setValidation,
    setExports,
    onStepChange: setCurrentStep,
    refreshHistory,
  });

  // Wire up the deferred reset callbacks now that hooks exist
  resetRefs.genSources = () => generation.setSources([]);
  resetRefs.editing = () => editing.reset();

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const checkUnsavedChanges = (onConfirm: () => void): void => {
    if (currentView === 'workflow' && (workout || generation.sources.length > 0) && !workoutSaved) {
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

  // ── Workout type dialog handlers ─────────────────────────────────────────────

  const handleWorkoutTypeConfirm = (selectedType: WorkoutType, applyDefaults: boolean) => {
    const pendingWorkout = workoutTypeDialog.pendingWorkout;
    if (!pendingWorkout) return;

    const finalWorkout = applyDefaults
      ? applyWorkoutTypeDefaults(pendingWorkout, selectedType)
      : { ...pendingWorkout, workout_type: selectedType };

    setWorkout(finalWorkout);
    setCurrentStep('structure');
    setWorkoutSaved(false);
    setWorkoutTypeDialog({ open: false, detectedType: 'mixed', confidence: 0, pendingWorkout: null });
    toast.success(
      applyDefaults ? `Workout type set to ${selectedType}. Settings applied!` : 'Workout structure generated!'
    );
  };

  const handleWorkoutTypeSkip = () => {
    const pendingWorkout = workoutTypeDialog.pendingWorkout;
    if (!pendingWorkout) return;
    setWorkout(pendingWorkout);
    setCurrentStep('structure');
    setWorkoutSaved(false);
    setWorkoutTypeDialog({ open: false, detectedType: 'mixed', confidence: 0, pendingWorkout: null });
    toast.success('Workout structure generated!');
  };

  // ── handleBack ───────────────────────────────────────────────────────────────

  const handleBack = () => {
    if (currentStepIndex > 0) {
      if (workout && !editing.isEditingFromHistory) {
        setConfirmDialog({
          open: true,
          title: 'Go Back?',
          description: 'Your current progress will be saved, but you may need to re-validate.',
          onConfirm: () => { setCurrentStep(steps[currentStepIndex - 1].id); },
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

  // ── Return everything merged ─────────────────────────────────────────────────

  return {
    // bridge state
    workout,
    setWorkout,
    workoutSaved,
    setWorkoutSaved,
    currentStep,
    setCurrentStep,
    currentStepIndex,
    validation,
    setValidation,
    exports,
    setExports,
    importProcessedItems,
    setImportProcessedItems,
    confirmDialog,
    setConfirmDialog,
    workoutTypeDialog,
    steps,
    // generation
    sources: generation.sources,
    loading: generation.loading || validationHook.loading,
    generationProgress: generation.generationProgress,
    apiAvailable: generation.apiAvailable,
    showStravaEnhance: generation.showStravaEnhance,
    pinterestBulkModal: generation.pinterestBulkModal,
    welcomeDismissed: generation.welcomeDismissed,
    buildTimestamp: generation.buildTimestamp,
    handleGenerateStructure: generation.handleGenerateStructure,
    handleCancelGeneration: generation.handleCancelGeneration,
    handlePinterestBulkImport: generation.handlePinterestBulkImport,
    handlePinterestEditSingle: generation.handlePinterestEditSingle,
    handlePinterestBulkClose: generation.handlePinterestBulkClose,
    handleLoadTemplate: generation.handleLoadTemplate,
    handleCreateNew: generation.handleCreateNew,
    handleStartNew: generation.handleStartNew,
    handleWelcomeDismiss: generation.handleWelcomeDismiss,
    // editing
    isEditingFromHistory: editing.isEditingFromHistory,
    isCreatingFromScratch: editing.isCreatingFromScratch,
    isEditingFromImport: editing.isEditingFromImport,
    editingWorkoutId: editing.editingWorkoutId,
    editingImportQueueId: editing.editingImportQueueId,
    selectedProgramId: editing.selectedProgramId,
    setSelectedProgramId: editing.setSelectedProgramId,
    handleLoadFromHistory: editing.handleLoadFromHistory,
    handleEditFromHistory: editing.handleEditFromHistory,
    handleBulkDeleteWorkouts: editing.handleBulkDeleteWorkouts,
    handleSaveFromStructure: editing.handleSaveFromStructure,
    handleEditFromImport: editing.handleEditFromImport,
    handleBackToImport: editing.handleBackToImport,
    resetEditingFlags: editing.reset,
    // validation
    handleAutoMap: validationHook.handleAutoMap,
    handleValidate: validationHook.handleValidate,
    handleReValidate: validationHook.handleReValidate,
    handleProcess: validationHook.handleProcess,
    // composer handlers
    handleWorkoutTypeConfirm,
    handleWorkoutTypeSkip,
    handleBack,
    checkUnsavedChanges,
    clearWorkflowState,
  };
}
