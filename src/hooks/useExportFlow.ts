import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  exportWorkoutToDevice,
  saveUserMapping as apiSaveUserMapping,
} from '../lib/mapper-api';
import { saveWorkoutToHistory } from '../lib/workout-history';
import { getDeviceById } from '../lib/devices';
import type { WorkoutStructure, WorkoutStructureType } from '../types/workout';
import type { DeviceId } from '../lib/devices';

export interface ExportQueueItem {
  workoutId: string;
  workout: WorkoutStructure;
  status: 'pending' | 'exporting' | 'done' | 'error';
  error?: string;
}

export interface ConflictItem {
  blockLabel: string;
  structure: WorkoutStructureType;
  description: string;
  deviceWarning: string;
}

interface UseExportFlowProps {
  userId: string;
}

export interface UseExportFlowReturn {
  queue: ExportQueueItem[];
  destination: DeviceId;
  mappings: Record<string, string>;
  loading: boolean;
  addToQueue: (workout: WorkoutStructure) => void;
  removeFromQueue: (workoutId: string) => void;
  setDestination: (device: DeviceId) => void;
  resolveMapping: (exerciseName: string, garminName: string) => void;
  detectConflicts: (workout: WorkoutStructure, device: DeviceId) => ConflictItem[];
  exportInline: (workout: WorkoutStructure, device: DeviceId, userId: string) => Promise<void>;
  exportAll: () => Promise<void>;
}

const COMPLEX_STRUCTURES: WorkoutStructureType[] = ['emom', 'amrap', 'for-time', 'tabata'];

const STRUCTURE_WARNINGS: Record<string, { description: string; deviceWarning: string }> = {
  emom: {
    description: 'Every Minute On the Minute',
    deviceWarning: 'Will be represented as timed intervals. Some formatting may differ on the watch face.',
  },
  amrap: {
    description: 'As Many Rounds As Possible',
    deviceWarning: 'Will be exported as a timed block. Round counting may not be supported by the device.',
  },
  'for-time': {
    description: 'For Time',
    deviceWarning: 'Will be exported as a timed block without built-in completion tracking.',
  },
  tabata: {
    description: 'Tabata intervals',
    deviceWarning: 'Will be exported as alternating work/rest intervals.',
  },
};

function generateWorkoutId(workout: WorkoutStructure): string {
  return `${workout.title}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useExportFlow({ userId }: UseExportFlowProps): UseExportFlowReturn {
  const [queue, setQueue] = useState<ExportQueueItem[]>([]);
  const [destination, setDestinationState] = useState<DeviceId>('garmin');
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const addToQueue = useCallback((workout: WorkoutStructure) => {
    setQueue(prev => [
      ...prev,
      { workoutId: generateWorkoutId(workout), workout, status: 'pending' },
    ]);
  }, []);

  const removeFromQueue = useCallback((workoutId: string) => {
    setQueue(prev => prev.filter(item => item.workoutId !== workoutId));
  }, []);

  const setDestination = useCallback((device: DeviceId) => {
    setDestinationState(device);
  }, []);

  const resolveMapping = useCallback((exerciseName: string, garminName: string) => {
    setMappings(prev => ({ ...prev, [exerciseName]: garminName }));
    apiSaveUserMapping(exerciseName, garminName).catch(() => {});
  }, []);

  const detectConflicts = useCallback(
    (workout: WorkoutStructure, device: DeviceId): ConflictItem[] => {
      const deviceConfig = getDeviceById(device);
      if (!deviceConfig?.requiresMapping) return [];

      const conflicts: ConflictItem[] = [];
      for (const block of workout.blocks || []) {
        if (block.structure && COMPLEX_STRUCTURES.includes(block.structure as WorkoutStructureType)) {
          const warning = STRUCTURE_WARNINGS[block.structure as string];
          if (warning) {
            conflicts.push({
              blockLabel: block.label,
              structure: block.structure as WorkoutStructureType,
              description: warning.description,
              deviceWarning: warning.deviceWarning,
            });
          }
        }
      }
      return conflicts;
    },
    []
  );

  const exportInline = useCallback(
    async (workout: WorkoutStructure, device: DeviceId, uid: string) => {
      setLoading(true);
      try {
        const exportFormats = await exportWorkoutToDevice(workout, device, null);
        await saveWorkoutToHistory(uid, workout, device, exportFormats, [], undefined, undefined);
        toast.success(`Exported to ${getDeviceById(device)?.name ?? device}!`);
      } catch (err: any) {
        toast.error(`Export failed: ${err.message ?? 'Unknown error'}`);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const exportAll = useCallback(async () => {
    setLoading(true);
    const pending = queue.filter(item => item.status === 'pending');
    for (const item of pending) {
      setQueue(prev =>
        prev.map(q => (q.workoutId === item.workoutId ? { ...q, status: 'exporting' } : q))
      );
      try {
        const exportFormats = await exportWorkoutToDevice(item.workout, destination, null);
        await saveWorkoutToHistory(userId, item.workout, destination, exportFormats, [], undefined, undefined);
        setQueue(prev =>
          prev.map(q => (q.workoutId === item.workoutId ? { ...q, status: 'done' } : q))
        );
      } catch (err: any) {
        setQueue(prev =>
          prev.map(q =>
            q.workoutId === item.workoutId
              ? { ...q, status: 'error', error: err.message ?? 'Export failed' }
              : q
          )
        );
      }
    }
    setLoading(false);
    const failed = queue.filter(q => q.status === 'error').length;
    if (failed > 0) {
      toast.error(`${failed} workout(s) failed to export`);
    } else {
      toast.success(`All workouts exported to ${getDeviceById(destination)?.name ?? destination}!`);
    }
  }, [queue, destination, userId]);

  return {
    queue,
    destination,
    mappings,
    loading,
    addToQueue,
    removeFromQueue,
    setDestination,
    resolveMapping,
    detectConflicts,
    exportInline,
    exportAll,
  };
}
