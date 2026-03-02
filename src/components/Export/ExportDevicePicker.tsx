import { useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { DeviceConfig } from '../../lib/devices';

interface ExportDevicePickerProps {
  workoutId: string;
  devices: DeviceConfig[];
  onInlineExport: (device: DeviceConfig) => void;
  onOpenExportPage: (device: DeviceConfig) => void;
}

export function ExportDevicePicker({
  workoutId: _workoutId,
  devices,
  onInlineExport,
  onOpenExportPage,
}: ExportDevicePickerProps) {
  const [exportingDevice, setExportingDevice] = useState<string | null>(null);

  const availableDevices = devices.filter(d => d.exportMethod !== 'coming_soon');

  const handleDeviceClick = async (device: DeviceConfig) => {
    if (device.requiresMapping) {
      onOpenExportPage(device);
    } else {
      setExportingDevice(device.id);
      try {
        await onInlineExport(device);
      } finally {
        setExportingDevice(null);
      }
    }
  };

  return (
    <div className="space-y-1">
      {availableDevices.map(device => {
        const isExporting = exportingDevice === device.id;
        const requiresPage = device.requiresMapping;
        return (
          <button
            key={device.id}
            data-testid={`export-picker-${device.id}`}
            onClick={() => handleDeviceClick(device)}
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
  );
}
