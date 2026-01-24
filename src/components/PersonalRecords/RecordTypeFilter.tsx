/**
 * Filter component for personal record types.
 *
 * Part of AMA-482: Create Personal Records (PRs) Component
 *
 * Provides toggle buttons to filter PRs by record type (1RM, Max Weight, Max Reps).
 */

import { Button } from '../ui/button';
import type { RecordType } from '../../types/progression';

export type RecordTypeFilterValue = RecordType | 'all';

interface RecordTypeFilterProps {
  value: RecordTypeFilterValue;
  onChange: (type: RecordTypeFilterValue) => void;
}

const FILTER_OPTIONS: { value: RecordTypeFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: '1rm', label: '1RM' },
  { value: 'max_weight', label: 'Max Weight' },
  { value: 'max_reps', label: 'Max Reps' },
];

export function RecordTypeFilter({ value, onChange }: RecordTypeFilterProps) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="record-type-filter">
      {FILTER_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(option.value)}
          data-testid={`filter-${option.value}`}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
