import { useState } from 'react';
import { toast } from 'sonner';
import { exportWorkoutToDevice } from '../../lib/mapper-api';
import type { WorkoutStructure, ValidationResponse, ExportFormats } from '../../types/workout';
import type { DeviceId, DeviceConfig } from '../../lib/devices';
import type { View } from '../router';

export interface UseWorkflowValidationProps {
  selectedDevice: DeviceId;
  setCurrentView: (v: View) => void;
}

export interface UseWorkflowValidationResult {
  validation: ValidationResponse | null;
  setValidation: (v: ValidationResponse | null) => void;
  exports: ExportFormats | null;
  setExports: (e: ExportFormats | null) => void;
  exportingWorkout: WorkoutStructure | null;
  exportingWorkouts: WorkoutStructure[];
  exportingDevice: DeviceId | null;
  handleOpenExportPage: (workout: WorkoutStructure, device: DeviceConfig) => void;
  handleInlineExport: (workout: WorkoutStructure, device: DeviceConfig) => Promise<void>;
  handleBatchExport: (workouts: WorkoutStructure[]) => void;
  handleExportBack: () => void;
  resetExportState: () => void;
}

export function useWorkflowValidation({
  selectedDevice: _selectedDevice,
  setCurrentView,
}: UseWorkflowValidationProps): UseWorkflowValidationResult {
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [exports, setExports] = useState<ExportFormats | null>(null);
  const [exportingWorkout, setExportingWorkout] = useState<WorkoutStructure | null>(null);
  const [exportingWorkouts, setExportingWorkouts] = useState<WorkoutStructure[]>([]);
  const [exportingDevice, setExportingDevice] = useState<DeviceId | null>(null);

  const handleOpenExportPage = (workout: WorkoutStructure, device: DeviceConfig) => {
    setExportingWorkout(workout);
    setExportingDevice(device.id);
    setCurrentView('export-page');
  };

  const handleInlineExport = async (workout: WorkoutStructure, device: DeviceConfig) => {
    try {
      toast.info(`Exporting "${workout.title || 'Workout'}" to ${device.name}...`);
      await exportWorkoutToDevice(workout, device.id);
      toast.success(`Exported to ${device.name}!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Export failed';
      toast.error(message);
    }
  };

  const handleBatchExport = (workouts: WorkoutStructure[]) => {
    setExportingWorkouts(workouts);
    setExportingWorkout(null);
    setExportingDevice(null);
    setCurrentView('export-page');
  };

  const handleExportBack = () => {
    setCurrentView('workouts');
    setExportingWorkout(null);
    setExportingWorkouts([]);
    setExportingDevice(null);
  };

  const resetExportState = () => {
    setExportingWorkout(null);
    setExportingWorkouts([]);
    setExportingDevice(null);
  };

  return {
    validation,
    setValidation,
    exports,
    setExports,
    exportingWorkout,
    exportingWorkouts,
    exportingDevice,
    handleOpenExportPage,
    handleInlineExport,
    handleBatchExport,
    handleExportBack,
    resetExportState,
  };
}
