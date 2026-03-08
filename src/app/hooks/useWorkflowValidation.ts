import { useState } from 'react';
import { toast } from 'sonner';
import { exportWorkoutToDevice } from '../../lib/mapper-api';
import type { WorkoutStructure, ValidationResponse, ExportFormats } from '../../types/workout';
import type { DeviceId, DeviceConfig } from '../../lib/devices';

export interface UseWorkflowValidationProps {
  workout: WorkoutStructure | null;
  userId: string;
  selectedDevice: DeviceId;
  setWorkout: (w: WorkoutStructure | null) => void;
  onStepChange: (step: 'add-sources' | 'structure') => void;
  setValidation: (v: ValidationResponse | null) => void;
  setExports: (e: ExportFormats | null) => void;
  stravaConnected: boolean;
}

export interface UseWorkflowValidationResult {
  // Export state (moved from WorkflowView.tsx)
  exportingWorkout: WorkoutStructure | null;
  exportingWorkouts: WorkoutStructure[];
  exportingDevice: DeviceId | null;
  // Validation/Export state from bridge (now owned by this hook)
  validation: ValidationResponse | null;
  exports: ExportFormats | null;
  // Export handlers (moved from WorkflowView.tsx)
  handleOpenExportPage: (workout: WorkoutStructure, device: DeviceConfig) => void;
  handleInlineExport: (workout: WorkoutStructure, device: DeviceConfig) => Promise<void>;
  // Validation handlers
  handleAutoMap: () => Promise<void>;
  handleValidate: () => Promise<void>;
  handleReValidate: () => Promise<void>;
  handleProcess: (workout: WorkoutStructure) => Promise<void>;
  // State setters for clearing export state
  setExportingWorkout: (w: WorkoutStructure | null) => void;
  setExportingWorkouts: (ws: WorkoutStructure[]) => void;
  setExportingDevice: (d: DeviceId | null) => void;
}

export function useWorkflowValidation({
  workout,
  userId,
  selectedDevice,
  setWorkout,
  onStepChange,
  setValidation,
  setExports,
  stravaConnected,
}: UseWorkflowValidationProps): UseWorkflowValidationResult {
  // Export state (moved from WorkflowView.tsx)
  const [exportingWorkout, setExportingWorkout] = useState<WorkoutStructure | null>(null);
  const [exportingWorkouts, setExportingWorkouts] = useState<WorkoutStructure[]>([]);
  const [exportingDevice, setExportingDevice] = useState<DeviceId | null>(null);

  // Validation/Export state (moved from bridge in useWorkflowState)
  const [validation, setValidationState] = useState<ValidationResponse | null>(null);
  const [exports, setExportsState] = useState<ExportFormats | null>(null);

  const handleOpenExportPage = (workoutToExport: WorkoutStructure, device: DeviceConfig) => {
    setExportingWorkout(workoutToExport);
    setExportingDevice(device.id);
    // Note: setCurrentView is handled by the caller (WorkflowView)
  };

  const handleInlineExport = async (workoutToExport: WorkoutStructure, device: DeviceConfig): Promise<void> => {
    try {
      toast.info(`Exporting "${workoutToExport.title || 'Workout'}" to ${device.name}...`);
      await exportWorkoutToDevice(workoutToExport, device.id);
      toast.success(`Exported to ${device.name}!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Export failed';
      toast.error(message);
    }
  };

  const handleAutoMap = async (): Promise<void> => {
    // Auto-map functionality - would typically call mapping API
    // This is a placeholder - the actual implementation depends on the mapping API
    if (!workout) return;
    
    try {
      const { autoMapWorkout } = await import('../../lib/mapper-api');
      const mapped = await autoMapWorkout(workout);
      setWorkout(mapped);
      toast.success('Exercises auto-mapped successfully!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Auto-map failed';
      toast.error(message);
    }
  };

  const handleValidate = async (): Promise<void> => {
    if (!workout) return;

    try {
      const { validateWorkoutMapping } = await import('../../lib/mapper-api');
      const result = await validateWorkoutMapping(workout, selectedDevice);
      setValidationState(result);
      setValidation(result); // Call the prop callback for bridge state sync
      
      if (result.can_proceed) {
        toast.success('Validation passed!');
      } else {
        toast.warning('Validation completed with issues. Please review.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      toast.error(message);
    }
  };

  const handleReValidate = async (): Promise<void> => {
    // Re-validate is the same as validate - just calls the validation again
    await handleValidate();
  };

  const handleProcess = async (workoutToProcess: WorkoutStructure): Promise<void> => {
    try {
      const { processWorkoutWithValidation } = await import('../../lib/mapper-api');
      const result = await processWorkoutWithValidation(workoutToProcess, selectedDevice);
      
      setValidationState(result.validation);
      setExportsState({ yaml: result.yaml });
      setValidation(result.validation); // Call the prop callback for bridge state sync
      setExports({ yaml: result.yaml }); // Call the prop callback for bridge state sync
      
      toast.success('Workout processed successfully!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      toast.error(message);
    }
  };

  return {
    // Export state
    exportingWorkout,
    exportingWorkouts,
    exportingDevice,
    // Validation/Export state
    validation,
    exports,
    // Export handlers
    handleOpenExportPage,
    handleInlineExport,
    // Validation handlers
    handleAutoMap,
    handleValidate,
    handleReValidate,
    handleProcess,
    // State setters
    setExportingWorkout,
    setExportingWorkouts,
    setExportingDevice,
  };
}
