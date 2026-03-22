/**
 * AMA-121: Bulk export dialog for exporting multiple workouts at once.
 *
 * Shows a list of selected workouts, format selection, and preview
 * before exporting them all together.
 */

import { useState, useCallback } from 'react';
import { Download, X, FileJson, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { ExportFormatPicker, type ExportFormatOption } from './ExportFormatPicker';
import { downloadWorkoutJson, downloadBulkWorkoutJson, workoutToJsonString } from '../../lib/export-json';
import { downloadFitFile } from '../../lib/export-fit';
import { exportAndDownload, type WorkoutExportData } from '../../lib/export-api';
import type { WorkoutStructure } from '../../types/workout';

type ExportStatus = 'idle' | 'exporting' | 'success' | 'error';

interface BulkExportDialogProps {
  workouts: WorkoutStructure[];
  onClose: () => void;
  /** If true, client-side FIT/JSON are preferred over API calls */
  preferClientSide?: boolean;
}

/**
 * Convert WorkoutStructure to the WorkoutExportData shape the export-api expects.
 */
function toExportData(workout: WorkoutStructure): WorkoutExportData {
  return {
    title: workout.title,
    source: workout.source,
    blocks: workout.blocks.map(block => ({
      label: block.label,
      structure: block.structure ?? undefined,
      exercises: block.exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets ?? undefined,
        reps: ex.reps ?? undefined,
        reps_range: ex.reps_range ?? undefined,
        duration_sec: ex.duration_sec ?? undefined,
        rest_sec: ex.rest_sec ?? undefined,
        distance_m: ex.distance_m ?? undefined,
        notes: ex.notes ?? undefined,
      })),
      supersets: block.supersets?.map(ss => ({
        exercises: ss.exercises.map(ex => ({
          name: ex.name,
          sets: ex.sets ?? undefined,
          reps: ex.reps ?? undefined,
          reps_range: ex.reps_range ?? undefined,
          duration_sec: ex.duration_sec ?? undefined,
          rest_sec: ex.rest_sec ?? undefined,
          distance_m: ex.distance_m ?? undefined,
          notes: ex.notes ?? undefined,
        })),
        rest_between_sec: ss.rest_between_sec ?? undefined,
      })),
      time_work_sec: block.time_work_sec ?? undefined,
      rest_between_sec: block.rest_between_rounds_sec ?? block.rest_between_sec ?? undefined,
    })),
  };
}

export function BulkExportDialog({
  workouts,
  onClose,
  preferClientSide = true,
}: BulkExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatOption | null>(null);
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFormatSelect = useCallback((format: ExportFormatOption) => {
    setSelectedFormat(format);
    setError(null);

    // Generate preview for JSON
    if (format === 'json' && workouts.length > 0) {
      const previewStr = workoutToJsonString(workouts[0]);
      setPreview(previewStr.substring(0, 500) + (previewStr.length > 500 ? '\n...' : ''));
    } else {
      setPreview(null);
    }
  }, [workouts]);

  const handleExport = useCallback(async () => {
    if (!selectedFormat || workouts.length === 0) return;

    setStatus('exporting');
    setError(null);

    try {
      if (selectedFormat === 'json' && preferClientSide) {
        // Client-side JSON export
        if (workouts.length === 1) {
          downloadWorkoutJson(workouts[0]);
        } else {
          downloadBulkWorkoutJson(workouts);
        }
      } else if (selectedFormat === 'fit' && preferClientSide) {
        // Client-side FIT export (one file per workout)
        for (const workout of workouts) {
          downloadFitFile(workout);
        }
      } else {
        // API-backed export for other formats
        for (const workout of workouts) {
          const exportData = toExportData(workout);
          await exportAndDownload(exportData, selectedFormat);
        }
      }

      setStatus('success');
      // Auto-close after a brief success message
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  }, [selectedFormat, workouts, preferClientSide, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      data-testid="bulk-export-dialog"
    >
      <div className="bg-background rounded-xl shadow-lg w-full max-w-lg max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Export Workouts</h2>
            <p className="text-sm text-muted-foreground">
              {workouts.length} workout{workouts.length !== 1 ? 's' : ''} selected
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workout list */}
        <div className="p-4 border-b">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Workouts</h3>
          <ul className="space-y-1 max-h-32 overflow-y-auto">
            {workouts.map((w, i) => (
              <li key={i} className="text-sm flex items-center gap-2 py-1">
                <FileJson className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="truncate">{w.title}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {w.blocks.reduce((sum, b) => sum + b.exercises.length, 0)} exercises
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Format selection */}
        <div className="p-4 border-b">
          <ExportFormatPicker
            selectedFormat={selectedFormat}
            onSelectFormat={handleFormatSelect}
          />
        </div>

        {/* Preview */}
        {preview && (
          <div className="p-4 border-b">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Preview</h3>
            <pre
              className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-40"
              data-testid="export-preview-content"
            >
              {preview}
            </pre>
          </div>
        )}

        {/* Status / Error */}
        {error && (
          <div className="p-4 flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {status === 'success' && (
          <div className="p-4 flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Export complete!
          </div>
        )}

        {/* Actions */}
        <div className="p-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={!selectedFormat || status === 'exporting' || status === 'success'}
            data-testid="export-download-btn"
          >
            {status === 'exporting' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download {workouts.length > 1 ? `${workouts.length} files` : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
