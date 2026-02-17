/**
 * StepCounter - Collapsible header showing step count for AI assistant panel.
 * Displays "N steps completed" with a toggle chevron. Children are hidden
 * by default (collapsed state) and can be expanded on click.
 */

import React, { useState } from 'react';

interface StepCounterProps {
  /** Number of completed steps (0 = render nothing) */
  count: number;
  /** Number of errored steps (shown separately in label) */
  errorCount?: number;
  /** Child components to render inside (typically TimelineRail) */
  children: React.ReactNode;
  /** Optional className for custom styling */
  className?: string;
  /** Unique ID for aria-controls (avoids collisions when multiple instances exist) */
  contentId?: string;
}

/**
 * Renders a collapsible header with step count.
 * - count={0} → renders nothing
 * - Shows "N steps completed" text with chevron indicator
 * - Click toggles children visibility
 * - Children hidden by default (collapsed)
 */
export function StepCounter({ count, errorCount = 0, children, className = '', contentId }: StepCounterProps) {
  // Nothing to show when no steps completed or errored
  if (count === 0 && errorCount === 0) {
    return null;
  }

  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={className}>
      {/* Collapsible header */}
      <button
        type="button"
        onClick={handleToggle}
        className="
          flex items-center gap-2
          w-full
          px-3 py-2
          text-sm text-slate-300
          hover:text-slate-100
          hover:bg-slate-800/50
          rounded-md
          transition-colors duration-150
          cursor-pointer
        "
        aria-expanded={isExpanded}
        aria-controls={contentId ?? 'step-counter-content'}
      >
        {/* Chevron icon */}
        <span
          className={`
            inline-flex items-center
            transition-transform duration-200
            ${isExpanded ? 'rotate-90' : ''}
          `}
          aria-hidden="true"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4.5 2L8.5 6L4.5 10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        {/* Step count text */}
        <span className="flex-1 text-left">
          {count} {count === 1 ? 'step' : 'steps'} completed
          {errorCount > 0 && (
            <span className="text-red-400">, {errorCount} failed</span>
          )}
        </span>
      </button>

      {/* Collapsible content */}
      <div
        id={contentId ?? 'step-counter-content'}
        className={`
          overflow-hidden
          transition-all duration-200 ease-in-out
          ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}
        `}
        aria-hidden={!isExpanded}
      >
        <div className="pt-1 pb-2">
          {children}
        </div>
      </div>
    </div>
  );
}
