import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { ExportQueue } from './ExportQueue';
import { ExportConfig } from './ExportConfig';
import { ExportPreview } from './ExportPreview';
import { useExportFlow } from '../../hooks/useExportFlow';
import { getDeviceById } from '../../lib/devices';
import { isDemoMode } from '../../lib/demo-mode';
import type { DeviceConfig, DeviceId } from '../../lib/devices';
import type { WorkoutStructure } from '../../types/workout';

interface UnresolvedMapping {
  exerciseId: string;
  exerciseName: string;
  suggestions: Array<{ name: string; confidence: number }>;
}

const DEMO_UNRESOLVED_MAPPINGS: UnresolvedMapping[] = [
  {
    exerciseId: 'demo-ex-1',
    exerciseName: 'Overhead Press',
    suggestions: [
      { name: 'Shoulder Press', confidence: 0.91 },
      { name: 'Military Press', confidence: 0.78 },
      { name: 'DB Shoulder Press', confidence: 0.64 },
    ],
  },
  {
    exerciseId: 'demo-ex-2',
    exerciseName: 'Cable Row',
    suggestions: [
      { name: 'Seated Cable Row', confidence: 0.88 },
      { name: 'Low Cable Row', confidence: 0.73 },
      { name: 'Cable Seated Row', confidence: 0.61 },
    ],
  },
];

interface ExportPageProps {
  initialWorkout?: WorkoutStructure;
  initialWorkouts?: WorkoutStructure[];  // new: batch entry
  initialDevice?: DeviceId;
  devices: DeviceConfig[];
  onBack: () => void;
}

export function ExportPage({ initialWorkout, initialWorkouts, initialDevice, devices, onBack }: ExportPageProps) {
  const {
    queue,
    destination,
    loading,
    mappings,
    addToQueue,
    removeFromQueue,
    setDestination,
    resolveMapping,
    detectConflicts,
    exportAll,
  } = useExportFlow({ userId: '' });

  const [unresolvedMappings, setUnresolvedMappings] = useState<UnresolvedMapping[]>(
    isDemoMode ? DEMO_UNRESOLVED_MAPPINGS : []
  );

  const [previewWorkoutId, setPreviewWorkoutId] = useState<string | null>(null);

  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    if (initialWorkout) {
      addToQueue(initialWorkout);
    }
    if (initialWorkouts && initialWorkouts.length > 0) {
      initialWorkouts.forEach(w => addToQueue(w));
    }
    if (initialDevice) {
      setDestination(initialDevice);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset preview selection if the selected workout is removed from the queue
  useEffect(() => {
    if (previewWorkoutId && !queue.find(i => i.workoutId === previewWorkoutId)) {
      setPreviewWorkoutId(null);
    }
  }, [queue, previewWorkoutId]);

  const isBatch = queue.length > 1;
  const previewItem = isBatch
    ? (queue.find(i => i.workoutId === previewWorkoutId) ?? queue[0])
    : queue[0];
  const previewWorkout = previewItem?.workout ?? initialWorkout ?? null;
  const previewSubtitle = isBatch && previewItem ? `Previewing: ${previewItem.workout.title}` : undefined;

  // Aggregate conflicts across all queued workouts
  const allConflicts = queue.flatMap(item =>
    detectConflicts(item.workout, destination).map(c => ({
      ...c,
      workoutTitle: isBatch ? item.workout.title : undefined,
    }))
  );

  const currentDevice = getDeviceById(destination) ?? null;

  const handleResolveMapping = (exerciseId: string, mappedName: string) => {
    const mapping = unresolvedMappings.find(m => m.exerciseId === exerciseId);
    if (mapping) resolveMapping(mapping.exerciseName, mappedName);
    setUnresolvedMappings(prev => prev.filter(m => m.exerciseId !== exerciseId));
  };

  return (
    <div className="space-y-4" data-testid="export-page">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <ExportQueue
          queue={queue}
          onRemove={removeFromQueue}
          selectedWorkoutId={isBatch ? (previewItem?.workoutId ?? null) : null}
          onSelectWorkout={isBatch ? setPreviewWorkoutId : undefined}
        />
        <ExportConfig
          devices={devices}
          destination={destination}
          onSetDestination={setDestination}
          conflicts={allConflicts}
          unresolvedMappings={unresolvedMappings}
          onResolveMapping={handleResolveMapping}
          onExportAll={exportAll}
          loading={loading}
          queueSize={queue.length}
        />
        <ExportPreview
          workout={previewWorkout}
          device={currentDevice}
          mappings={mappings}
          subtitle={previewSubtitle}
        />
      </div>
    </div>
  );
}
