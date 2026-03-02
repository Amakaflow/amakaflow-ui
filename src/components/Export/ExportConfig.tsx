import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { ConflictCard } from './ConflictCard';
import { MappingResolutionCard } from './MappingResolutionCard';
import type { DeviceConfig, DeviceId } from '../../lib/devices';
import type { ConflictItem } from '../../hooks/useExportFlow';

interface ExportConfigProps {
  devices: DeviceConfig[];
  destination: DeviceId | null;
  onSetDestination: (id: DeviceId) => void;
  unresolvedMappings: Array<{
    exerciseId: string;
    exerciseName: string;
    suggestions: Array<{ name: string; confidence: number }>;
  }>;
  conflicts: ConflictItem[];
  onResolveMapping: (exerciseId: string, mappedName: string) => void;
  onExportAll: () => void;
  loading: boolean;
  queueSize: number;
}

export function ExportConfig({
  devices,
  destination,
  onSetDestination,
  conflicts,
  unresolvedMappings,
  onResolveMapping,
  onExportAll,
  loading,
  queueSize,
}: ExportConfigProps) {
  const availableDevices = devices.filter(d => d.exportMethod !== 'coming_soon');
  const canExport = queueSize > 0 && !loading;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Destination</Label>
          <Select
            value={destination ?? undefined}
            onValueChange={v => onSetDestination(v as DeviceId)}
          >
            <SelectTrigger data-testid="export-destination-select">
              <SelectValue placeholder="Choose destination" />
            </SelectTrigger>
            <SelectContent>
              {availableDevices.map(d => (
                <SelectItem key={d.id} value={d.id}>
                  <div className="flex items-center gap-2">
                    <span>{d.icon}</span>
                    <span>{d.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {conflicts.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-orange-600">Structure Warnings</Label>
            {conflicts.map((c, i) => (
              <ConflictCard key={i} conflict={c} />
            ))}
          </div>
        )}

        {unresolvedMappings.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">
              Exercise Mapping ({unresolvedMappings.length} to resolve)
            </Label>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {unresolvedMappings.map((item, i) => (
                <MappingResolutionCard
                  key={i}
                  exerciseId={item.exerciseId}
                  exerciseName={item.exerciseName}
                  suggestions={item.suggestions}
                  onResolve={onResolveMapping}
                />
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={onExportAll}
          disabled={!canExport}
          className="w-full gap-2"
          data-testid="export-all-button"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Exporting…</>
          ) : (
            `Export ${queueSize > 1 ? `${queueSize} Workouts` : 'Workout'}`
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
