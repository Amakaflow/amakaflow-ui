/**
 * TimelineRail - Vertical timeline rail for the AI assistant panel
 * showing tool execution steps with status indicators.
 */

import React from 'react';
import { TimelineStep, StepStatus } from './TimelineStep';

export interface TimelineStepData {
  /** Step label */
  label: string;
  /** Optional result summary */
  result?: string;
  /** Step status */
  status: StepStatus;
}

interface TimelineRailProps {
  /** Array of timeline steps */
  steps: TimelineStepData[];
  /** Optional className for custom styling */
  className?: string;
}

/**
 * Renders a vertical timeline with connected steps.
 * - Done steps: checkmark + teal
 * - Active step: pulsing ring + spinner
 * - Pending steps: dimmed hollow dot
 * - Error steps: X mark + red
 * 
 * Returns null if steps array is empty.
 */
export function TimelineRail({ steps, className = '' }: TimelineRailProps) {
  // Empty steps array → render nothing
  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <div 
      className={`py-2 ${className}`}
      role="list"
      aria-label="Execution timeline"
    >
      {steps.map((step, index) => (
        <TimelineStep
          key={index}
          label={step.label}
          result={step.result}
          status={step.status}
          isLast={index === steps.length - 1}
        />
      ))}
    </div>
  );
}
