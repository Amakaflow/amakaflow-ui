/**
 * AMA-121: Export format selection component.
 *
 * Allows user to select an export format (FIT, JSON, CSV, etc.)
 * and shows format-specific information.
 */

import { useState } from 'react';
import { FileJson, FileText, FileDown, HardDrive, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

export type ExportFormatOption = 'fit' | 'json' | 'csv' | 'tcx' | 'text' | 'pdf';

interface FormatInfo {
  id: ExportFormatOption;
  label: string;
  description: string;
  icon: React.ReactNode;
  extension: string;
  badge?: string;
}

const FORMAT_OPTIONS: FormatInfo[] = [
  {
    id: 'fit',
    label: 'Garmin FIT',
    description: 'Binary format for Garmin devices and Connect',
    icon: <HardDrive className="w-5 h-5" />,
    extension: '.fit',
    badge: 'Garmin',
  },
  {
    id: 'json',
    label: 'JSON',
    description: 'Structured data for import/export and integrations',
    icon: <FileJson className="w-5 h-5" />,
    extension: '.json',
  },
  {
    id: 'csv',
    label: 'CSV (Strong)',
    description: 'Compatible with Strong, Hevy, and HeavySet apps',
    icon: <FileText className="w-5 h-5" />,
    extension: '.csv',
    badge: 'Strong',
  },
  {
    id: 'tcx',
    label: 'TCX',
    description: 'Training Center XML for GPS-enabled devices',
    icon: <FileDown className="w-5 h-5" />,
    extension: '.tcx',
  },
  {
    id: 'text',
    label: 'Text',
    description: 'Plain text workout summary for sharing',
    icon: <FileText className="w-5 h-5" />,
    extension: '.txt',
  },
  {
    id: 'pdf',
    label: 'PDF',
    description: 'Printable workout sheet',
    icon: <FileDown className="w-5 h-5" />,
    extension: '.pdf',
  },
];

interface ExportFormatPickerProps {
  selectedFormat: ExportFormatOption | null;
  onSelectFormat: (format: ExportFormatOption) => void;
  /** Limit which formats are shown */
  availableFormats?: ExportFormatOption[];
  className?: string;
}

export function ExportFormatPicker({
  selectedFormat,
  onSelectFormat,
  availableFormats,
  className,
}: ExportFormatPickerProps) {
  const formats = availableFormats
    ? FORMAT_OPTIONS.filter(f => availableFormats.includes(f.id))
    : FORMAT_OPTIONS;

  return (
    <div className={cn('space-y-2', className)} data-testid="export-format-picker">
      <h3 className="text-sm font-medium text-muted-foreground">Export Format</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {formats.map(format => {
          const isSelected = selectedFormat === format.id;
          return (
            <button
              key={format.id}
              data-testid={`export-format-${format.id}`}
              onClick={() => onSelectFormat(format.id)}
              className={cn(
                'relative flex flex-col items-start p-3 rounded-lg border text-left transition-colors',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
            >
              {isSelected && (
                <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />
              )}
              <div className="flex items-center gap-2 mb-1">
                {format.icon}
                <span className="font-medium text-sm">{format.label}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-tight">
                {format.description}
              </p>
              {format.badge && (
                <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  {format.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
