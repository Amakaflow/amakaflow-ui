import { cn } from '../../../components/ui/utils';
import type { PipelineStep, StepStatus } from '../store/runTypes';

interface StepCardProps {
  step: PipelineStep;
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_COLORS: Record<StepStatus, string> = {
  pending: 'border-muted-foreground/20 bg-muted/30',
  running: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 animate-pulse',
  success: 'border-green-400 bg-green-50 dark:bg-green-950/20',
  failed: 'border-red-400 bg-red-50 dark:bg-red-950/20',
  skipped: 'border-muted-foreground/20 bg-muted/10',
  paused: 'border-blue-400 bg-blue-50 dark:bg-blue-950/20',
};

const STATUS_ICON: Record<StepStatus, string> = {
  pending: '○',
  running: '●',
  success: '✓',
  failed: '✗',
  skipped: '—',
  paused: '⏸',
};

export function StepCard({ step, isSelected, onClick }: StepCardProps) {
  const durationText =
    step.durationMs !== undefined ? `${step.durationMs}ms` : step.status === 'running' ? '…' : '';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left border rounded-md p-3 transition-colors',
        STATUS_COLORS[step.status],
        isSelected && 'ring-2 ring-primary ring-offset-1',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono">{STATUS_ICON[step.status]}</span>
          <span className="text-sm font-medium">{step.label}</span>
          <span className="text-xs text-muted-foreground">{step.service}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {step.edited && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              edited
            </span>
          )}
          {step.schemaValidation && (
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                step.schemaValidation.passed
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              )}
            >
              {step.schemaValidation.passed ? 'schema ✓' : `schema ✗ (${step.schemaValidation.errors?.length ?? 0})`}
            </span>
          )}
          {durationText && (
            <span className="text-xs text-muted-foreground">{durationText}</span>
          )}
        </div>
      </div>
      {step.status === 'failed' && step.error && (
        <div className="mt-1 text-xs text-red-600 dark:text-red-400 truncate">{step.error}</div>
      )}
    </button>
  );
}
