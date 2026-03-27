/**
 * ProgressContext — React context so any component can trigger a progress overlay.
 * Part of AMA-1154 Live Progress View.
 */

import React, { createContext, useContext, useCallback, useState } from 'react';
import { ProgressOverlay } from './ProgressOverlay';
import { useProgressStream } from './hooks/useProgressStream';
import type { ProgressOperation } from './types';

// ============================================================================
// Context shape
// ============================================================================

interface ProgressContextValue {
  /** Start showing a progress overlay */
  startProgress: (
    operationId: string,
    title: string,
    steps: { id: string; label: string }[],
  ) => void;
  /** Cancel the current progress operation */
  cancelProgress: () => void;
  /** Whether a progress operation is currently active */
  isProgressActive: boolean;
  /** The current operation, if any */
  currentOperation: ProgressOperation | null;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface ProgressProviderProps {
  children: React.ReactNode;
  /** If true, uses demo/simulated progress instead of SSE */
  demo?: boolean;
  /** Delay per step in demo mode (ms) */
  demoStepDelayMs?: number;
}

export function ProgressProvider({
  children,
  demo = false,
  demoStepDelayMs,
}: ProgressProviderProps) {
  const [visible, setVisible] = useState(false);

  const { operation, start, cancel, isActive } = useProgressStream({
    demo,
    demoStepDelayMs,
    onComplete: () => {
      // Keep overlay visible — auto-dismiss happens in ProgressOverlay
    },
  });

  const startProgress = useCallback(
    (operationId: string, title: string, steps: { id: string; label: string }[]) => {
      setVisible(true);
      start(operationId, title, steps);
    },
    [start],
  );

  const cancelProgress = useCallback(() => {
    cancel();
  }, [cancel]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const value: ProgressContextValue = {
    startProgress,
    cancelProgress,
    isProgressActive: isActive,
    currentOperation: operation,
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
      {visible && operation && (
        <ProgressOverlay
          operation={operation}
          onCancel={cancelProgress}
          onDismiss={handleDismiss}
        />
      )}
    </ProgressContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return ctx;
}
