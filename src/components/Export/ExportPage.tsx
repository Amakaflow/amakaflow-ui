import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { ExportQueue } from './ExportQueue';
import { ExportConfig } from './ExportConfig';
import { ExportPreview } from './ExportPreview';
import { useExportFlow } from '../../hooks/useExportFlow';
import { getDeviceById } from '../../lib/devices';
import type { DeviceConfig, DeviceId } from '../../lib/devices';
import type { WorkoutStructure } from '../../types/workout';

interface ExportPageProps {
  initialWorkout?: WorkoutStructure;
  initialDevice?: DeviceId;
  devices: DeviceConfig[];
  onBack: () => void;
}

export function ExportPage({ initialWorkout, initialDevice, devices, onBack }: ExportPageProps) {
  const {
    queue,
    destination,
    loading,
    addToQueue,
    removeFromQueue,
    setDestination,
    resolveMapping,
    detectConflicts,
    exportAll,
  } = useExportFlow({ userId: '' });

  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    if (initialWorkout) {
      addToQueue(initialWorkout);
    }
    if (initialDevice && initialDevice !== 'garmin') {
      setDestination(initialDevice);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const firstWorkout = queue[0]?.workout ?? initialWorkout ?? null;
  const conflicts = firstWorkout ? detectConflicts(firstWorkout, destination) : [];
  const currentDevice = getDeviceById(destination) ?? null;

  return (
    <div className="space-y-4" data-testid="export-page">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <ExportQueue queue={queue} onRemove={removeFromQueue} />
        <ExportConfig
          devices={devices}
          destination={destination}
          onSetDestination={setDestination}
          conflicts={conflicts}
          unresolvedMappings={[]}
          onResolveMapping={resolveMapping}
          onExportAll={exportAll}
          loading={loading}
          queueSize={queue.length}
        />
        <ExportPreview
          workout={firstWorkout}
          device={currentDevice}
        />
      </div>
    </div>
  );
}
