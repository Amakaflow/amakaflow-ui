import { useState } from 'react';
import { toast } from 'sonner';
import { normalizeWorkoutStructure } from '../../lib/api';
import type { WorkoutStructure, ValidationResponse, ExportFormats } from '../../types/workout';
import type { ProcessedItem } from '../../types/import';
import type { Source } from '../../components/AddSources';
import type { View } from '../router';
import type { DeviceId } from '../../lib/devices';
import type React from 'react';

type WorkflowStep = 'add-sources' | 'structure' | 'validate' | 'export';

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

export interface UseWorkflowEditingProps {
  userId: string;
  selectedDevice: DeviceId;
  setSelectedDevice: (d: DeviceId) => void;
  refreshHistory: () => Promise<void>;
  onStepChange: (step: WorkflowStep) => void;
  onViewChange: (view: View) => void;
  setWorkout: (w: WorkoutStructure | null) => void;
  setWorkoutSaved: (saved: boolean) => void;
  setSources: (sources: Source[]) => void;
  setValidation: (v: ValidationResponse | null) => void;
  setExports: (e: ExportFormats | null) => void;
  setConfirmDialog: React.Dispatch<React.SetStateAction<ConfirmDialogState>>;
  workout: WorkoutStructure | null;
  workoutSaved: boolean;
  importProcessedItems: ProcessedItem[];
  setImportProcessedItems: React.Dispatch<React.SetStateAction<ProcessedItem[]>>;
}

export interface UseWorkflowEditingResult {
  isEditingFromHistory: boolean;
  isCreatingFromScratch: boolean;
  isEditingFromImport: boolean;
  editingWorkoutId: string | null;
  editingImportQueueId: string | null;
  selectedProgramId: string | null;
  setSelectedProgramId: (id: string | null) => void;
  handleLoadFromHistory: (historyItem: any) => void;
  handleEditFromHistory: (historyItem: any) => void;
  handleBulkDeleteWorkouts: (ids: string[]) => Promise<void>;
  handleSaveFromStructure: (
    exports: ExportFormats | null,
    sources: Source[],
    validation: ValidationResponse | null
  ) => Promise<void>;
  handleEditFromImport: (queueId: string, rawWorkout: Record<string, unknown>) => void;
  handleBackToImport: (currentWorkout: WorkoutStructure | null) => void;
  reset: () => void;
}

export function useWorkflowEditing({
  userId,
  selectedDevice,
  setSelectedDevice,
  refreshHistory,
  onStepChange,
  onViewChange,
  setWorkout,
  setWorkoutSaved,
  setSources,
  setValidation,
  setExports,
  setConfirmDialog: _setConfirmDialog,
  workout,
  workoutSaved: _workoutSaved,
  importProcessedItems: _importProcessedItems,
  setImportProcessedItems,
}: UseWorkflowEditingProps): UseWorkflowEditingResult {
  const [isEditingFromHistory, setIsEditingFromHistory] = useState(false);
  const [isCreatingFromScratch, setIsCreatingFromScratch] = useState(false);
  const [isEditingFromImport, setIsEditingFromImport] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editingImportQueueId, setEditingImportQueueId] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  const parseSourceStrings = (sources: string[]): Source[] =>
    sources.map(s => {
      const [type, ...content] = s.split(':');
      return {
        id: Math.random().toString(),
        type: type as Source['type'],
        content: content.join(':'),
      };
    });

  const handleLoadFromHistory = (historyItem: any) => {
    setWorkout(historyItem.workout);
    setSources(parseSourceStrings(historyItem.sources || []));
    setSelectedDevice(historyItem.device);
    setValidation(historyItem.validation || null);
    setExports(historyItem.exports || null);
    setIsEditingFromHistory(true);
    setEditingWorkoutId(historyItem.id);
    onStepChange('export');
    onViewChange('workflow');
    setWorkoutSaved(true);
    toast.success('Workout loaded');
  };

  const handleEditFromHistory = (historyItem: any) => {
    const normalizedWorkout = normalizeWorkoutStructure(historyItem.workout);
    setWorkout(normalizedWorkout);
    setSources(parseSourceStrings(historyItem.sources || []));
    setSelectedDevice(historyItem.device);
    setValidation(historyItem.validation || null);
    setExports(historyItem.exports || null);
    onStepChange('structure');
    onViewChange('workflow');
    setIsEditingFromHistory(true);
    setEditingWorkoutId(historyItem.id);
    setWorkoutSaved(true);
    toast.success('Workout opened for editing - you can edit directly or re-validate if needed');
  };

  const handleBulkDeleteWorkouts = async (ids: string[]): Promise<void> => {
    if (!ids || ids.length === 0) return;
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const id of ids) {
      try {
        const { deleteWorkoutFromHistory } = await import('../../lib/workout-history');
        const ok = await deleteWorkoutFromHistory(id, userId);
        if (ok) succeeded.push(id);
        else failed.push(id);
      } catch (error) {
        console.error(`Error deleting workout ${id}:`, error);
        failed.push(id);
      }
    }

    if (succeeded.length > 0) await refreshHistory();

    if (failed.length > 0 && succeeded.length > 0) {
      toast.warning(`Deleted ${succeeded.length} workout(s). Failed to delete ${failed.length}.`);
    } else if (failed.length > 0) {
      toast.error(`Failed to delete ${failed.length} workout(s).`);
    } else {
      toast.success(`Deleted ${ids.length} workout(s).`);
    }
  };

  const handleSaveFromStructure = async (
    currentExports: ExportFormats | null,
    currentSources: Source[],
    currentValidation: ValidationResponse | null
  ): Promise<void> => {
    if (!userId || !workout) return;
    try {
      const { saveWorkoutToHistory } = await import('../../lib/workout-history');
      await saveWorkoutToHistory(
        userId,
        workout,
        selectedDevice,
        currentExports || undefined,
        currentSources.map(s => `${s.type}:${s.content}`),
        currentValidation || undefined,
        editingWorkoutId || undefined
      );
      toast.success('Workout saved!');
      setWorkoutSaved(true);
      await refreshHistory();
      if (isEditingFromHistory) {
        onViewChange('workouts');
        setIsEditingFromHistory(false);
        setEditingWorkoutId(null);
      } else if (isCreatingFromScratch) {
        setIsCreatingFromScratch(false);
      }
    } catch (error: any) {
      toast.error(`Failed to save workout: ${error.message}`);
    }
  };

  const handleEditFromImport = (queueId: string, rawWorkout: Record<string, unknown>): void => {
    setEditingImportQueueId(queueId || null);
    const normalizedWorkout = normalizeWorkoutStructure(rawWorkout as WorkoutStructure);
    setWorkout(normalizedWorkout);
    setValidation(null);
    setExports(null);
    setSources([]);
    setIsEditingFromHistory(true);
    setIsEditingFromImport(true);
    setEditingWorkoutId(null);
    setWorkoutSaved(false);
    onViewChange('workflow');
    onStepChange('structure');
  };

  const handleBackToImport = (currentWorkout: WorkoutStructure | null): void => {
    if (editingImportQueueId && currentWorkout) {
      setImportProcessedItems(prev =>
        prev.map(item =>
          item.queueId === editingImportQueueId
            ? {
                ...item,
                workout: currentWorkout as unknown as Record<string, unknown>,
                workoutTitle: currentWorkout.name,
                blockCount: currentWorkout.blocks?.length,
                exerciseCount: currentWorkout.blocks?.reduce(
                  (acc, b) => acc + (b.exercises?.length ?? 0),
                  0
                ),
              }
            : item
        )
      );
    }
    setEditingImportQueueId(null);
    onViewChange('import');
    setIsEditingFromHistory(false);
    setIsEditingFromImport(false);
    setEditingWorkoutId(null);
  };

  const reset = () => {
    setIsEditingFromHistory(false);
    setIsCreatingFromScratch(false);
    setIsEditingFromImport(false);
    setEditingWorkoutId(null);
    setEditingImportQueueId(null);
  };

  return {
    isEditingFromHistory,
    isCreatingFromScratch,
    isEditingFromImport,
    editingWorkoutId,
    editingImportQueueId,
    selectedProgramId,
    setSelectedProgramId,
    handleLoadFromHistory,
    handleEditFromHistory,
    handleBulkDeleteWorkouts,
    handleSaveFromStructure,
    handleEditFromImport,
    handleBackToImport,
    reset,
  };
}
