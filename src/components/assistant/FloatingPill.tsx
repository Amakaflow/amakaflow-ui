/**
 * FloatingPill - Floating status pill showing current AI action.
 * Displays at bottom-center of the main area with pulsing green dot,
 * label text, and step counter (e.g., "3 of 7").
 */

import React from 'react';

interface FloatingPillProps {
  /** Whether the pill is visible */
  visible: boolean;
  /** Current step number (1-indexed) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Label text describing the current action */
  label: string;
}

export function FloatingPill({
  visible,
  currentStep,
  totalSteps,
  label,
}: FloatingPillProps) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className="
          flex items-center gap-3
          bg-slate-800/95 backdrop-blur-sm
          px-4 py-2.5
          rounded-full
          shadow-lg shadow-black/25
          border border-slate-700/50
        "
      >
        {/* Pulsing green dot */}
        <span
          className="
            relative flex h-2.5 w-2.5
          "
          aria-hidden="true"
        >
          <span
            className="
              animate-ping
              absolute inline-flex h-full w-full
              rounded-full bg-emerald-400 opacity-75
            "
          />
          <span
            className="
              relative inline-flex rounded-full h-2.5 w-2.5
              bg-emerald-500
            "
          />
        </span>

        {/* Label text */}
        <span className="text-sm text-slate-200 font-medium">
          {label}
        </span>

        {/* Step counter — hidden until first timeline step arrives */}
        {totalSteps > 0 && (
          <span className="text-xs text-slate-400">
            {currentStep} of {totalSteps}
          </span>
        )}
      </div>
    </div>
  );
}
