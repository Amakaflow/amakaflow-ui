import { useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Badge } from '../ui/badge';
import { getPrimaryExportDestinations, getDeviceById } from '../../lib/devices';
import type { DeviceId } from '../../lib/devices';
import type { WorkoutStructure } from '../../types/workout';

interface ExportDevicePickerProps {
  workout: WorkoutStructure;
  userId: string;
  trigger: React.ReactNode;
  onInlineExport: (workout: WorkoutStructure, device: DeviceId) => Promise<void>;
  onOpenExportPage: (workout: WorkoutStructure, device: DeviceId) => void;
}

export function ExportDevicePicker({
  workout,
  userId: _userId,
  trigger,
  onInlineExport,
  onOpenExportPage,
}: ExportDevicePickerProps) {
  const [open, setOpen] = useState(false);
  const [exportingDevice, setExportingDevice] = useState<DeviceId | null>(null);

  const devices = getPrimaryExportDestinations().filter(
    d => d.exportMethod !== 'coming_soon'
  );

  const handleDeviceClick = async (deviceId: DeviceId) => {
    const device = getDeviceById(deviceId);
    if (!device) return;

    if (device.requiresMapping) {
      setOpen(false);
      onOpenExportPage(workout, deviceId);
    } else {
      setExportingDevice(deviceId);
      try {
        await onInlineExport(workout, deviceId);
        setOpen(false);
      } finally {
        setExportingDevice(null);
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <p className="text-xs text-muted-foreground px-2 pb-2 font-medium uppercase tracking-wide">
          Export to
        </p>
        <div className="space-y-1">
          {devices.map(device => {
            const isExporting = exportingDevice === device.id;
            const requiresPage = device.requiresMapping;
            return (
              <button
                key={device.id}
                data-testid={`export-picker-${device.id}`}
                onClick={() => handleDeviceClick(device.id)}
                disabled={isExporting}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted text-left transition-colors disabled:opacity-50"
              >
                <span className="text-lg">{device.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{device.name}</p>
                </div>
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : requiresPage ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className="text-xs px-1">Map</Badge>
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </div>
                ) : (
                  <Badge variant="secondary" className="text-xs shrink-0">1-tap</Badge>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
