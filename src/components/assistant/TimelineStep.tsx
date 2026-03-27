/**
 * TimelineStep - Individual step in the timeline rail.
 * Shows status indicator with label and optional result summary.
 */

import React from 'react';

export type StepStatus = 'done' | 'active' | 'pending' | 'error';

interface TimelineStepProps {
  /** Step label (e.g., "Analyzing request") */
  label: string;
  /** Optional result summary (e.g., "Found 3 files") */
  result?: string;
  /** Step status */
  status: StepStatus;
  /** Whether this is the last step (no connecting line below) */
  isLast?: boolean;
}

export function TimelineStep({ label, result, status, isLast = false }: TimelineStepProps) {
  return (
    <div 
      className="flex gap-3 relative"
      data-status={status}
      role="listitem"
    >
      {/* Status indicator column */}
      <div className="flex flex-col items-center">
        {/* Status indicator */}
        <div className="relative w-5 h-5 flex-shrink-0">
          {status === 'done' && (
            // Done: teal checkmark
            <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {status === 'active' && (
            // Active: pulsing ring + spinner
            <div className="relative flex items-center justify-center w-5 h-5">
              {/* Pulsing ring */}
              <span className="absolute w-5 h-5 rounded-full border-2 border-teal-400 animate-ping opacity-75" />
              {/* Spinner */}
              <svg className="w-4 h-4 text-teal-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}

          {status === 'pending' && (
            // Pending: dimmed hollow dot
            <div className="w-5 h-5 rounded-full border-2 border-slate-400 bg-transparent" />
          )}

          {status === 'error' && (
            // Error: red X mark
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>

        {/* Connecting line to next step */}
        {!isLast && (
          <div 
            className={`w-0.5 h-8 mt-1 ${
              status === 'done' ? 'bg-teal-500' : 'bg-slate-300'
            }`}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Content column */}
      <div className="flex flex-col pb-4">
        <span 
          className={`text-sm font-medium ${
            status === 'pending' ? 'text-slate-400' : 'text-slate-200'
          }`}
        >
          {label}
        </span>
        {result && (
          <span className="text-xs text-slate-400 mt-0.5">
            {result}
          </span>
        )}
      </div>
    </div>
  );
}
