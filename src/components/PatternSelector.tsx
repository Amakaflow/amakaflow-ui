/**
 * AMA-182: Pattern selector UI for exercise settings.
 *
 * Allows users to choose a rep pattern (standard, ascending, descending, pyramid)
 * and previews the resulting rep sequence.
 */

import React from 'react';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';
import type { RepPattern } from '../types/workout';
import {
  REP_PATTERN_LABELS,
  REP_PATTERN_DESCRIPTIONS,
  getPatternPreview,
} from '../lib/rep-patterns';

export interface PatternSelectorProps {
  /** Currently selected pattern */
  value: RepPattern;
  /** Called when user selects a new pattern */
  onChange: (pattern: RepPattern) => void;
  /** Base rep count for preview */
  baseReps?: number;
  /** Number of sets for preview */
  sets?: number;
  /** Rep step for preview (default: 2) */
  step?: number;
  /** Optional CSS class */
  className?: string;
}

const PATTERNS: RepPattern[] = ['standard', 'ascending', 'descending', 'pyramid'];

export function PatternSelector({
  value,
  onChange,
  baseReps = 8,
  sets = 4,
  step = 2,
  className,
}: PatternSelectorProps) {
  return (
    <div data-testid="pattern-selector" className={cn('space-y-2', className)}>
      <label className="text-sm font-medium">Rep Pattern</label>
      <div className="grid grid-cols-2 gap-2">
        {PATTERNS.map((pattern) => (
          <button
            key={pattern}
            type="button"
            data-testid={`pattern-option-${pattern}`}
            onClick={() => onChange(pattern)}
            className={cn(
              'flex flex-col items-start rounded-lg border p-3 text-left transition-colors',
              value === pattern
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50',
            )}
          >
            <span className="text-sm font-medium">{REP_PATTERN_LABELS[pattern]}</span>
            <span className="text-xs text-muted-foreground mt-0.5">
              {REP_PATTERN_DESCRIPTIONS[pattern]}
            </span>
          </button>
        ))}
      </div>
      {value !== 'standard' && (
        <div data-testid="pattern-preview" className="mt-2">
          <Badge variant="secondary" className="text-xs font-mono">
            {getPatternPreview(baseReps, sets, value, step)}
          </Badge>
        </div>
      )}
    </div>
  );
}
