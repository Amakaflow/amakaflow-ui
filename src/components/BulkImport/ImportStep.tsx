/**
 * ImportStep Component
 *
 * Step 5 of bulk import: Import execution and results.
 * Shows progress during import and results after completion.
 */

import { useMemo } from 'react';
import { useBulkImport } from '../../context/BulkImportContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Calendar,
  FolderOpen,
  RotateCcw,
  Download,
  Sparkles,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { ImportResultStatus } from '../../types/bulk-import';

interface ImportStepProps {
  userId: string;
  onViewCalendar?: () => void;
  onViewPrograms?: () => void;
  onReset: () => void;
  onStartImport?: () => void;
}

// Result status config
const resultStatusConfig: Record<ImportResultStatus, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  success: { icon: CheckCircle, label: 'Imported', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  failed: { icon: XCircle, label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/10' },
  skipped: { icon: AlertTriangle, label: 'Skipped', color: 'text-amber-400', bg: 'bg-amber-500/10' },
};

export function ImportStep({ userId, onViewCalendar, onViewPrograms, onReset, onStartImport }: ImportStepProps) {
  const { state, dispatch } = useBulkImport();

  // Calculate result counts
  const resultCounts = useMemo(() => {
    const counts = { success: 0, failed: 0, skipped: 0, total: state.import.results.length };
    state.import.results.forEach(r => {
      counts[r.status]++;
    });
    return counts;
  }, [state.import.results]);

  // Is import in progress
  const isIdle = state.import.status === 'idle';
  const isRunning = state.import.status === 'running';
  const isComplete = state.import.status === 'complete';
  const isFailed = state.import.status === 'failed';
  const isCancelled = state.import.status === 'cancelled';

  return (
    <div className="space-y-6">
      {/* Idle State - Ready to start import */}
      {isIdle && (
        <div className="space-y-6">
          <div className="text-center py-8">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 border-4 border-primary/20 flex items-center justify-center">
                <Download className="w-10 h-10 text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mt-6 mb-2">Ready to Import</h3>
            <p className="text-muted-foreground">
              {state.preview.stats.totalSelected} workout{state.preview.stats.totalSelected !== 1 ? 's' : ''} ready to be imported
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => dispatch({ type: 'SET_STEP', step: 'preview' })}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            {onStartImport && (
              <Button onClick={onStartImport} className="h-12">
                <Download className="w-5 h-5 mr-2" />
                Start Import
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Progress Section (during import) */}
      {isRunning && (
        <div className="space-y-6">
          {/* Progress Header */}
          <div className="text-center py-8">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border-4 border-primary/20 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mt-6 mb-2">Importing Workouts</h3>
            <p className="text-muted-foreground">
              {state.import.currentItem
                ? `Processing: ${state.import.currentItem}`
                : 'Preparing import...'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{state.import.progress}%</span>
            </div>
            <Progress value={state.import.progress} className="h-3" />
            <p className="text-sm text-muted-foreground text-center">
              {resultCounts.success} of {resultCounts.total || state.preview.stats.totalSelected} imported
            </p>
          </div>

          {/* Cancel Button */}
          <Button
            variant="outline"
            onClick={() => dispatch({ type: 'SET_IMPORT_STATUS', status: 'cancelled' })}
            className="w-full"
          >
            Cancel Import
          </Button>
        </div>
      )}

      {/* Success State */}
      {isComplete && (
        <div className="space-y-6">
          {/* Success Header */}
          <div className="text-center py-8">
            <div className="relative inline-flex items-center justify-center">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mt-6 mb-2">Import Complete!</h3>
            <p className="text-muted-foreground">
              Successfully imported {resultCounts.success} workout{resultCounts.success !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-emerald-400">{resultCounts.success}</div>
              <div className="text-sm text-emerald-400/70">Imported</div>
            </div>
            {resultCounts.failed > 0 && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                <XCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-red-400">{resultCounts.failed}</div>
                <div className="text-sm text-red-400/70">Failed</div>
              </div>
            )}
            {resultCounts.skipped > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-amber-400">{resultCounts.skipped}</div>
                <div className="text-sm text-amber-400/70">Skipped</div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {onViewCalendar && (
              <Button variant="outline" onClick={onViewCalendar} className="h-12">
                <Calendar className="w-5 h-5 mr-2" />
                View Calendar
              </Button>
            )}
            {onViewPrograms && (
              <Button variant="outline" onClick={onViewPrograms} className="h-12">
                <FolderOpen className="w-5 h-5 mr-2" />
                View Programs
              </Button>
            )}
          </div>

          <Button onClick={onReset} className="w-full h-12" variant="default">
            <Sparkles className="w-5 h-5 mr-2" />
            Import More Workouts
          </Button>
        </div>
      )}

      {/* Failed State */}
      {isFailed && (
        <div className="space-y-6">
          <div className="text-center py-8">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mt-6 mb-2">Import Failed</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {state.import.error || 'An error occurred during import. Please try again.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Start Over
            </Button>
            <Button onClick={() => dispatch({ type: 'SET_STEP', step: 'preview' })}>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Review & Retry
            </Button>
          </div>
        </div>
      )}

      {/* Cancelled State */}
      {isCancelled && (
        <div className="space-y-6">
          <div className="text-center py-8">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-amber-400" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mt-6 mb-2">Import Cancelled</h3>
            <p className="text-muted-foreground">
              {resultCounts.success > 0
                ? `${resultCounts.success} workout${resultCounts.success !== 1 ? 's were' : ' was'} imported before cancellation.`
                : 'No workouts were imported.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Start Over
            </Button>
            <Button onClick={() => dispatch({ type: 'SET_STEP', step: 'preview' })}>
              Resume Import
            </Button>
          </div>
        </div>
      )}

      {/* Results List (for all terminal states) */}
      {(isComplete || isFailed || isCancelled) && state.import.results.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Import Results</h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {state.import.results.map((result, index) => {
              const config = resultStatusConfig[result.status];
              const IconComponent = config.icon;

              return (
                <div
                  key={index}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border',
                    config.bg,
                    'border-white/10'
                  )}
                >
                  <IconComponent className={cn('w-5 h-5 flex-shrink-0', config.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.title}</p>
                    {result.error && (
                      <p className="text-sm text-red-400/70 truncate">{result.error}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className={cn('text-xs', config.bg, config.color)}>
                    {config.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportStep;
