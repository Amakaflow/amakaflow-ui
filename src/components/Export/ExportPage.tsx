import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { ExportQueue } from './ExportQueue';
import { ExportConfig } from './ExportConfig';
import { ExportPreview } from './ExportPreview';
import { useExportFlow } from '../../hooks/useExportFlow';
import type { DeviceId } from '../../lib/devices';
import type { WorkoutStructure } from '../../types/workout';
import type { AppUser } from '../../app/useAppAuth';

interface ExportPageProps {
  user: AppUser;
  initialWorkout: WorkoutStructure;
  initialDevice: DeviceId;
  onBack: () => void;
}

export function ExportPage({ user, initialWorkout, initialDevice, onBack }: ExportPageProps) {
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
  } = useExportFlow({ userId: user.id });

  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    addToQueue(initialWorkout);
    if (initialDevice !== 'garmin') setDestination(initialDevice);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const firstWorkout = queue[0]?.workout ?? initialWorkout;
  const conflicts = detectConflicts(firstWorkout, destination);

  return (
    <div className="space-y-4" data-testid="export-page">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <ExportQueue queue={queue} onRemove={removeFromQueue} />
        <ExportConfig
          destination={destination}
          onDestinationChange={setDestination}
          conflicts={conflicts}
          unresolvedMappings={[]}
          onResolveMapping={resolveMapping}
          onExportAll={exportAll}
          loading={loading}
          queueSize={queue.length}
          onShowPreview={() => {}}
        />
        <ExportPreview
          workout={firstWorkout}
          destination={destination}
          defaultTab="device"
        />
      </div>
    </div>
  );
}
