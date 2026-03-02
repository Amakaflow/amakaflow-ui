import { useState } from 'react';
import { toast } from 'sonner';
import {
  validateWorkoutMapping,
  processWorkoutWithValidation,
  exportWorkoutToDevice,
  checkMapperApiHealth,
} from '../../lib/mapper-api';
import { saveWorkoutToHistory } from '../../lib/workout-history';
import { getDeviceById } from '../../lib/devices';
import type { WorkoutStructure, ValidationResponse, ExportFormats, Source } from '../../types/workout';
import type { AppUser } from '../useAppAuth';
import type { DeviceId } from '../../lib/devices';

type WorkflowStep = 'add-sources' | 'structure' | 'validate' | 'export';

export interface UseWorkflowValidationProps {
  workout: WorkoutStructure | null;
  selectedDevice: DeviceId;
  user: AppUser;
  sources: Source[];
  editingWorkoutId: string | null;
  setWorkout: (w: WorkoutStructure) => void;
  setWorkoutSaved: (saved: boolean) => void;
  setValidation: (v: ValidationResponse | null) => void;
  setExports: (e: ExportFormats | null) => void;
  onStepChange: (step: WorkflowStep) => void;
  refreshHistory: () => Promise<void>;
}

export interface UseWorkflowValidationResult {
  loading: boolean;
  handleAutoMap: () => Promise<void>;
  handleValidate: () => Promise<void>;
  handleReValidate: (updatedWorkout: WorkoutStructure) => Promise<void>;
  handleProcess: (updatedWorkout: WorkoutStructure) => Promise<void>;
}

export function useWorkflowValidation({
  workout,
  selectedDevice,
  user,
  sources,
  editingWorkoutId,
  setWorkout,
  setWorkoutSaved,
  setValidation,
  setExports,
  onStepChange,
  refreshHistory,
}: UseWorkflowValidationProps): UseWorkflowValidationResult {
  const [loading, setLoading] = useState(false);

  const handleAutoMap = async (): Promise<void> => {
    if (!workout) return;
    setLoading(true);
    try {
      const isMapperApiAvailable = await checkMapperApiHealth();
      let exportFormats: ExportFormats;
      let validationResult: ValidationResponse | null = null;

      if (isMapperApiAvailable) {
        validationResult = await validateWorkoutMapping(workout);
        setValidation(validationResult);
        exportFormats = await exportWorkoutToDevice(workout, selectedDevice, validationResult);
        setExports(exportFormats);
      } else {
        const { processWorkflow } = await import('../../lib/mock-api');
        exportFormats = await processWorkflow(workout, true);
        setExports(exportFormats);
      }

      if (user) {
        await saveWorkoutToHistory(
          user.id,
          workout,
          selectedDevice,
          exportFormats,
          sources.map((s: Source) => `${s.type}:${s.content}`),
          undefined,
          editingWorkoutId || undefined
        );
        setWorkoutSaved(true);
      }

      onStepChange('export');
      toast.success('Workout auto-mapped and ready to export!');
      await refreshHistory();
    } catch (error: any) {
      toast.error(`Failed to auto-map workout: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (): Promise<void> => {
    if (!workout) {
      toast.error('No workout to validate');
      return;
    }
    setLoading(true);
    try {
      const isMapperApiAvailable = await checkMapperApiHealth();
      let validationResult: ValidationResponse;

      if (isMapperApiAvailable) {
        validationResult = await validateWorkoutMapping(workout);
      } else {
        const { validateWorkout } = await import('../../lib/mock-api');
        validationResult = await validateWorkout(workout);
      }

      setValidation(validationResult);
      onStepChange('validate');
      if (validationResult.can_proceed) {
        toast.success('All exercises validated successfully!');
      } else {
        toast.warning('Some exercises need review');
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      toast.error(`Failed to validate workout: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReValidate = async (updatedWorkout: WorkoutStructure): Promise<void> => {
    setLoading(true);
    try {
      const isMapperApiAvailable = await checkMapperApiHealth();
      let validationResult: ValidationResponse;

      if (isMapperApiAvailable) {
        validationResult = await validateWorkoutMapping(updatedWorkout);
      } else {
        const { validateWorkout } = await import('../../lib/mock-api');
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

  const handleProcess = async (updatedWorkout: WorkoutStructure): Promise<void> => {
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
          } catch {
            exportFormats = { yaml: processResult.yaml || '' };
          }
        } else {
          exportFormats = { yaml: processResult.yaml || '' };
        }
      } else {
        const { processWorkflow } = await import('../../lib/mock-api');
        exportFormats = await processWorkflow(updatedWorkout, false);
      }

      setExports(exportFormats);
      setValidation(validationResult);
      setWorkout(updatedWorkout);
      onStepChange('export');

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

  return {
    loading,
    handleAutoMap,
    handleValidate,
    handleReValidate,
    handleProcess,
  };
}
