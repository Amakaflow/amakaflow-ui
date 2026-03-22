/**
 * ProgressStep — individual row showing a step's icon, label, status, and elapsed time.
 * Part of AMA-1154 Live Progress View.
 */

import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { cn } from '../ui/utils';
import type { ProgressStep as ProgressStepType } from './types';

interface ProgressStepProps {
  step: ProgressStepType;
  index: number;
}

function formatElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ProgressStepRow({ step, index }: ProgressStepProps) {
  return (
    <div
      data-testid={`progress-step-${step.id}`}
      data-status={step.status}
      className={cn(
        'flex items-center gap-3 py-3 px-4 rounded-lg transition-all duration-300',
        step.status === 'active' && 'bg-primary/5',
        step.status === 'completed' && 'opacity-80',
        step.status === 'pending' && 'opacity-40',
        step.status === 'error' && 'bg-destructive/5',
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
        {step.status === 'completed' && (
          <CheckCircle2
            className="w-5 h-5 text-green-500"
            data-testid={`step-icon-completed-${step.id}`}
          />
        )}
        {step.status === 'active' && (
          <Loader2
            className="w-5 h-5 text-primary animate-spin"
            data-testid={`step-icon-active-${step.id}`}
          />
        )}
        {step.status === 'pending' && (
          <Circle
            className="w-5 h-5 text-muted-foreground/40"
            data-testid={`step-icon-pending-${step.id}`}
          />
        )}
        {step.status === 'error' && (
          <XCircle
            className="w-5 h-5 text-destructive"
            data-testid={`step-icon-error-${step.id}`}
          />
        )}
      </div>

      {/* Label */}
      <span
        className={cn(
          'flex-1 text-sm font-medium',
          step.status === 'active' && 'text-foreground',
          step.status === 'completed' && 'text-muted-foreground',
          step.status === 'pending' && 'text-muted-foreground/60',
          step.status === 'error' && 'text-destructive',
        )}
      >
        {step.label}
        {step.error && (
          <span className="block text-xs text-destructive mt-0.5">{step.error}</span>
        )}
      </span>

      {/* Elapsed time / spinner indicator */}
      <div className="flex-shrink-0 w-14 text-right">
        {step.status === 'completed' && step.elapsedMs !== undefined && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatElapsed(step.elapsedMs)}
          </span>
        )}
        {step.status === 'active' && (
          <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
        )}
      </div>
    </div>
  );
}
