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
import { getPrimaryExportDestinations } from '../../lib/devices';
import type { DeviceId } from '../../lib/devices';
import type { ConflictItem } from '../../hooks/useExportFlow';
import type { ValidationResult } from '../../types/workout';

interface ExportConfigProps {
  destination: DeviceId;
  onDestinationChange: (device: DeviceId) => void;
  conflicts: ConflictItem[];
  unresolvedMappings: ValidationResult[];
  onResolveMapping: (original: string, mapped: string) => void;
  onExportAll: () => Promise<void>;
  loading: boolean;
  queueSize: number;
  onShowPreview: () => void;
}

export function ExportConfig({
  destination,
  onDestinationChange,
  conflicts,
  unresolvedMappings,
  onResolveMapping,
  onExportAll,
  loading,
  queueSize,
  onShowPreview,
}: ExportConfigProps) {
  const devices = getPrimaryExportDestinations().filter(d => d.exportMethod !== 'coming_soon');
  const canExport = queueSize > 0 && !loading;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Destination</Label>
          <Select value={destination} onValueChange={v => onDestinationChange(v as DeviceId)}>
            <SelectTrigger data-testid="export-destination-select">
              <SelectValue placeholder="Choose destination" />
            </SelectTrigger>
            <SelectContent>
              {devices.map(d => (
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
              <ConflictCard key={i} conflict={c} onShowPreview={onShowPreview} />
            ))}
          </div>
        )}

        {unresolvedMappings.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">
              Exercise Mapping ({unresolvedMappings.length} to resolve)
            </Label>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {unresolvedMappings.map((ex, i) => (
                <MappingResolutionCard key={i} exercise={ex} onResolve={onResolveMapping} />
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
