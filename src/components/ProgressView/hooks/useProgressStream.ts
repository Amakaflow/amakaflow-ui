/**
 * useProgressStream — manages SSE/polling for progress events (AMA-1154).
 *
 * In production, this would connect to an SSE endpoint.
 * For now, supports a "demo" mode that simulates progress with timers.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ProgressStep, ProgressOperation, StepStatus } from '../types';

export interface UseProgressStreamOptions {
  /** If true, simulate progress with timers instead of connecting to SSE */
  demo?: boolean;
  /** For demo mode: delay per step in ms (default 1500) */
  demoStepDelayMs?: number;
  /** SSE endpoint URL template — {operationId} will be replaced */
  sseUrl?: string;
  /** Called when all steps complete */
  onComplete?: (operation: ProgressOperation) => void;
  /** Called on cancellation */
  onCancel?: (operationId: string) => void;
}

export interface UseProgressStreamReturn {
  operation: ProgressOperation | null;
  /** Start tracking a new operation */
  start: (operationId: string, title: string, steps: { id: string; label: string }[]) => void;
  /** Cancel the current operation */
  cancel: () => void;
  /** Whether the operation is in progress */
  isActive: boolean;
  /** Whether all steps are completed */
  isComplete: boolean;
}

export function useProgressStream(options: UseProgressStreamOptions = {}): UseProgressStreamReturn {
  const {
    demo = false,
    demoStepDelayMs = 1500,
    onComplete,
    onCancel,
  } = options;

  const [operation, setOperation] = useState<ProgressOperation | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const stepStartTimesRef = useRef<Map<string, number>>(new Map());

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const cancel = useCallback(() => {
    clearTimers();
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setOperation((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        cancelled: true,
        finishedAt: Date.now(),
        steps: prev.steps.map((s) =>
          s.status === 'active' || s.status === 'pending'
            ? { ...s, status: 'pending' as StepStatus }
            : s,
        ),
      };
      onCancel?.(prev.operationId);
      return updated;
    });
  }, [clearTimers, onCancel]);

  const startDemo = useCallback(
    (operationId: string, title: string, stepDefs: { id: string; label: string }[]) => {
      clearTimers();

      const initialSteps: ProgressStep[] = stepDefs.map((s, i) => ({
        id: s.id,
        label: s.label,
        status: i === 0 ? 'active' : 'pending',
      }));

      const op: ProgressOperation = {
        operationId,
        title,
        steps: initialSteps,
        cancelled: false,
        startedAt: Date.now(),
      };

      stepStartTimesRef.current = new Map();
      stepStartTimesRef.current.set(stepDefs[0].id, Date.now());

      setOperation(op);

      // Schedule each step completion
      let cumulativeDelay = 0;
      stepDefs.forEach((stepDef, idx) => {
        // Vary the delay per step for realism
        const stepDelay = demoStepDelayMs + (idx % 2 === 0 ? 300 : -200);
        cumulativeDelay += stepDelay;

        const timer = setTimeout(() => {
          setOperation((prev) => {
            if (!prev || prev.cancelled) return prev;
            const now = Date.now();
            const stepStart = stepStartTimesRef.current.get(stepDef.id) || now;
            const elapsed = now - stepStart;

            const newSteps = prev.steps.map((s, i) => {
              if (i === idx) {
                return { ...s, status: 'completed' as StepStatus, elapsedMs: elapsed };
              }
              if (i === idx + 1) {
                stepStartTimesRef.current.set(s.id, now);
                return { ...s, status: 'active' as StepStatus };
              }
              return s;
            });

            const allDone = newSteps.every((s) => s.status === 'completed');
            const updated: ProgressOperation = {
              ...prev,
              steps: newSteps,
              finishedAt: allDone ? now : undefined,
            };

            if (allDone) {
              onComplete?.(updated);
            }

            return updated;
          });
        }, cumulativeDelay);

        timersRef.current.push(timer);
      });
    },
    [clearTimers, demoStepDelayMs, onComplete],
  );

  const startSSE = useCallback(
    (operationId: string, title: string, stepDefs: { id: string; label: string }[]) => {
      // SSE implementation — not yet wired to backend
      // For now, fall back to demo mode
      startDemo(operationId, title, stepDefs);
    },
    [startDemo],
  );

  const start = useCallback(
    (operationId: string, title: string, stepDefs: { id: string; label: string }[]) => {
      if (demo) {
        startDemo(operationId, title, stepDefs);
      } else {
        startSSE(operationId, title, stepDefs);
      }
    },
    [demo, startDemo, startSSE],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      eventSourceRef.current?.close();
    };
  }, [clearTimers]);

  const isActive = operation !== null && !operation.cancelled && !operation.finishedAt;
  const isComplete =
    operation !== null &&
    !operation.cancelled &&
    operation.steps.every((s) => s.status === 'completed');

  return { operation, start, cancel, isActive, isComplete };
}
