/**
 * ProgressOverlay — full-screen overlay showing step-by-step progress.
 * Part of AMA-1154 Live Progress View.
 *
 * Perplexity-style: shows an ordered list of steps with live status updates,
 * timing, and a cancel button. Auto-dismisses 2s after completion.
 */

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { ProgressStepRow } from './ProgressStep';
import type { ProgressOperation } from './types';

interface ProgressOverlayProps {
  operation: ProgressOperation;
  onCancel: () => void;
  onDismiss: () => void;
  /** Auto-dismiss delay in ms after completion (default 2000) */
  autoDismissMs?: number;
}

export function ProgressOverlay({
  operation,
  onCancel,
  onDismiss,
  autoDismissMs = 2000,
}: ProgressOverlayProps) {
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allCompleted = operation.steps.every((s) => s.status === 'completed');
  const isCancelled = operation.cancelled;

  // Auto-dismiss after completion
  useEffect(() => {
    if (allCompleted && !isCancelled) {
      dismissTimerRef.current = setTimeout(() => {
        onDismiss();
      }, autoDismissMs);
    }
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [allCompleted, isCancelled, autoDismissMs, onDismiss]);

  const totalElapsed = operation.finishedAt
    ? operation.finishedAt - operation.startedAt
    : Date.now() - operation.startedAt;

  return (
    <div
      data-testid="progress-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-label={operation.title}
      aria-modal="true"
    >
      <div className="w-full max-w-md mx-4 rounded-xl border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="text-base font-semibold text-foreground" data-testid="progress-title">
            {operation.title}
          </h2>
          {!allCompleted && !isCancelled && (
            <button
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close progress overlay"
              data-testid="progress-close-btn"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Steps */}
        <div className="px-3 py-2 space-y-0.5" data-testid="progress-steps-list">
          {operation.steps.map((step, i) => (
            <ProgressStepRow key={step.id} step={step} index={i} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 flex items-center justify-between border-t border-border/50 mt-2">
          {allCompleted ? (
            <span className="text-xs text-green-500 font-medium" data-testid="progress-done-label">
              Done in {(totalElapsed / 1000).toFixed(1)}s
            </span>
          ) : isCancelled ? (
            <span className="text-xs text-muted-foreground" data-testid="progress-cancelled-label">
              Cancelled
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {operation.steps.filter((s) => s.status === 'completed').length} of{' '}
              {operation.steps.length} steps
            </span>
          )}

          {!allCompleted && !isCancelled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              data-testid="progress-cancel-btn"
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Cancel
            </Button>
          )}

          {(allCompleted || isCancelled) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              data-testid="progress-dismiss-btn"
              className="text-xs"
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
