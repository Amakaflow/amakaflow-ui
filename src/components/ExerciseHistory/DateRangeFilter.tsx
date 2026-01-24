/**
 * Date range filter for exercise history.
 *
 * Part of AMA-481: Build Exercise History Page with 1RM Trends
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export type DateRange = '30d' | '90d' | '1y' | 'all';

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
}

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
  { value: 'all', label: 'All time' },
];

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px]" data-testid="date-range-filter-trigger">
        <SelectValue placeholder="Select range" />
      </SelectTrigger>
      <SelectContent data-testid="date-range-filter-content">
        {dateRangeOptions.map((option) => (
          <SelectItem key={option.value} value={option.value} data-testid={`date-range-option-${option.value}`}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Filter sessions by date range.
 */
export function filterByDateRange<T extends { workoutDate: string }>(
  sessions: T[] | undefined,
  range: DateRange
): T[] {
  if (!sessions) return [];
  if (range === 'all') return sessions;

  const now = new Date();
  const cutoff = new Date();

  switch (range) {
    case '30d':
      cutoff.setDate(now.getDate() - 30);
      break;
    case '90d':
      cutoff.setDate(now.getDate() - 90);
      break;
    case '1y':
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
  }

  return sessions.filter((s) => new Date(s.workoutDate) >= cutoff);
}
