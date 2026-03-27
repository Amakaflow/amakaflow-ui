/**
 * WorkoutFilterBar - Filter controls for unified workouts page
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Search,
  X,
  Filter,
  ChevronDown,
  Dumbbell,
  Video,
  Smartphone,
  Calendar,
  Cloud,
} from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../ui/utils';

import type {
  WorkoutFilters,
  DateRangePreset,
  SyncStatusFilter,
} from '../../lib/workout-filters';
import {
  DEFAULT_FILTERS,
  hasActiveFilters,
  countActiveFilters,
  getDateRangeLabel,
  getSyncStatusLabel,
} from '../../lib/workout-filters';
import type {
  WorkoutCategory,
  WorkoutSourceType,
  DevicePlatform,
  VideoPlatform,
} from '../../types/unified-workout';
import {
  CATEGORY_DISPLAY_NAMES,
  SOURCE_TYPE_DISPLAY_NAMES,
  DEVICE_PLATFORM_DISPLAY_NAMES,
  VIDEO_PLATFORM_DISPLAY_NAMES,
} from '../../types/unified-workout';

// =============================================================================
// Types
// =============================================================================

interface WorkoutFilterBarProps {
  filters: WorkoutFilters;
  onFiltersChange: (filters: WorkoutFilters) => void;
  totalCount?: number;
  filteredCount?: number;
  className?: string;
}

// =============================================================================
// Multi-Select Dropdown Component
// =============================================================================

interface MultiSelectOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface MultiSelectDropdownProps<T extends string> {
  label: string;
  options: MultiSelectOption<T>[];
  selected: T[];
  onSelectionChange: (selected: T[]) => void;
  icon?: React.ReactNode;
}

function MultiSelectDropdown<T extends string>({
  label,
  options,
  selected,
  onSelectionChange,
  icon,
}: MultiSelectDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = useCallback(
    (value: T) => {
      if (selected.includes(value)) {
        onSelectionChange(selected.filter((v) => v !== value));
      } else {
        onSelectionChange([...selected, value]);
      }
    },
    [selected, onSelectionChange]
  );

  const displayText = useMemo(() => {
    if (selected.length === 0) return label;
    if (selected.length === 1) {
      const option = options.find((o) => o.value === selected[0]);
      return option?.label || selected[0];
    }
    return `${selected.length} selected`;
  }, [selected, options, label]);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'justify-between min-w-[140px]',
          selected.length > 0 && 'border-primary/50 bg-primary/5'
        )}
      >
        <span className="flex items-center gap-2">
          {icon}
          <span className="truncate">{displayText}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => toggleOption(option.value)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
                    'hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-primary/10'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                    )}
                  >
                    {isSelected && (
                      <svg
                        className="h-3 w-3 text-primary-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  {option.icon}
                  <span>{option.label}</span>
                </button>
              );
            })}
            {selected.length > 0 && (
              <>
                <div className="my-1 h-px bg-border" />
                <button
                  onClick={() => onSelectionChange([])}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <X className="h-4 w-4" />
                  Clear selection
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Filter Chip Component
// =============================================================================

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1">
      {label}
      <button
        onClick={onRemove}
        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function WorkoutFilterBar({
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
  className,
}: WorkoutFilterBarProps) {
  // Debounced search
  const [searchInput, setSearchInput] = useState(filters.search);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchInput(value);
      // Debounce: update filters after 300ms
      const timeoutId = setTimeout(() => {
        onFiltersChange({ ...filters, search: value });
      }, 300);
      return () => clearTimeout(timeoutId);
    },
    [filters, onFiltersChange]
  );

  // Source type options
  const sourceTypeOptions: MultiSelectOption<WorkoutSourceType>[] = useMemo(
    () => [
      { value: 'device', label: 'Device Sync', icon: <Smartphone className="h-4 w-4" /> },
      { value: 'video', label: 'Video Workout', icon: <Video className="h-4 w-4" /> },
      { value: 'manual', label: 'Manual Entry' },
      { value: 'ai', label: 'AI Generated' },
    ],
    []
  );

  // Category options
  const categoryOptions: MultiSelectOption<WorkoutCategory>[] = useMemo(
    () =>
      Object.entries(CATEGORY_DISPLAY_NAMES).map(([value, label]) => ({
        value: value as WorkoutCategory,
        label,
      })),
    []
  );

  // Device platform options
  const devicePlatformOptions: MultiSelectOption<DevicePlatform>[] = useMemo(
    () =>
      Object.entries(DEVICE_PLATFORM_DISPLAY_NAMES).map(([value, label]) => ({
        value: value as DevicePlatform,
        label,
      })),
    []
  );

  // Video platform options
  const videoPlatformOptions: MultiSelectOption<VideoPlatform>[] = useMemo(
    () =>
      Object.entries(VIDEO_PLATFORM_DISPLAY_NAMES).map(([value, label]) => ({
        value: value as VideoPlatform,
        label,
      })),
    []
  );

  // Check if we should show platform filters
  const showDevicePlatforms =
    filters.sourceTypes.length === 0 || filters.sourceTypes.includes('device');
  const showVideoPlatforms =
    filters.sourceTypes.length === 0 || filters.sourceTypes.includes('video');

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    onFiltersChange(DEFAULT_FILTERS);
  }, [onFiltersChange]);

  // Active filter count
  const activeFilterCount = countActiveFilters(filters);
  const hasFilters = hasActiveFilters(filters);

  // Build active filter chips
  const filterChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];

    // Source types
    filters.sourceTypes.forEach((type) => {
      chips.push({
        label: SOURCE_TYPE_DISPLAY_NAMES[type],
        onRemove: () =>
          onFiltersChange({
            ...filters,
            sourceTypes: filters.sourceTypes.filter((t) => t !== type),
          }),
      });
    });

    // Categories
    filters.categories.forEach((cat) => {
      chips.push({
        label: CATEGORY_DISPLAY_NAMES[cat],
        onRemove: () =>
          onFiltersChange({
            ...filters,
            categories: filters.categories.filter((c) => c !== cat),
          }),
      });
    });

    // Device platforms
    filters.devicePlatforms.forEach((platform) => {
      chips.push({
        label: DEVICE_PLATFORM_DISPLAY_NAMES[platform],
        onRemove: () =>
          onFiltersChange({
            ...filters,
            devicePlatforms: filters.devicePlatforms.filter((p) => p !== platform),
          }),
      });
    });

    // Video platforms
    filters.videoPlatforms.forEach((platform) => {
      chips.push({
        label: VIDEO_PLATFORM_DISPLAY_NAMES[platform],
        onRemove: () =>
          onFiltersChange({
            ...filters,
            videoPlatforms: filters.videoPlatforms.filter((p) => p !== platform),
          }),
      });
    });

    // Date range
    if (filters.dateRange !== 'all') {
      chips.push({
        label: getDateRangeLabel(filters.dateRange),
        onRemove: () => onFiltersChange({ ...filters, dateRange: 'all' }),
      });
    }

    // Sync status
    if (filters.syncStatus !== 'all') {
      chips.push({
        label: getSyncStatusLabel(filters.syncStatus),
        onRemove: () => onFiltersChange({ ...filters, syncStatus: 'all' }),
      });
    }

    return chips;
  }, [filters, onFiltersChange]);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search and primary filters row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search workouts..."
            value={searchInput}
            onChange={handleSearchChange}
            className="pl-9 pr-8"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                onFiltersChange({ ...filters, search: '' });
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Source type filter */}
        <MultiSelectDropdown
          label="Source"
          options={sourceTypeOptions}
          selected={filters.sourceTypes}
          onSelectionChange={(sourceTypes) => onFiltersChange({ ...filters, sourceTypes })}
          icon={<Filter className="h-4 w-4" />}
        />

        {/* Category filter */}
        <MultiSelectDropdown
          label="Category"
          options={categoryOptions}
          selected={filters.categories}
          onSelectionChange={(categories) => onFiltersChange({ ...filters, categories })}
          icon={<Dumbbell className="h-4 w-4" />}
        />

        {/* Date range select */}
        <Select
          value={filters.dateRange}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, dateRange: value as DateRangePreset })
          }
        >
          <SelectTrigger size="sm" className="w-[140px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>

        {/* Sync status select */}
        <Select
          value={filters.syncStatus}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, syncStatus: value as SyncStatusFilter })
          }
        >
          <SelectTrigger size="sm" className="w-[130px]">
            <Cloud className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Sync status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="synced">Synced</SelectItem>
            <SelectItem value="not-synced">Not Synced</SelectItem>
          </SelectContent>
        </Select>

        {/* Platform sub-filters (conditional) */}
        {showDevicePlatforms && filters.sourceTypes.includes('device') && (
          <MultiSelectDropdown
            label="Device"
            options={devicePlatformOptions}
            selected={filters.devicePlatforms}
            onSelectionChange={(devicePlatforms) =>
              onFiltersChange({ ...filters, devicePlatforms })
            }
            icon={<Smartphone className="h-4 w-4" />}
          />
        )}

        {showVideoPlatforms && filters.sourceTypes.includes('video') && (
          <MultiSelectDropdown
            label="Platform"
            options={videoPlatformOptions}
            selected={filters.videoPlatforms}
            onSelectionChange={(videoPlatforms) =>
              onFiltersChange({ ...filters, videoPlatforms })
            }
            icon={<Video className="h-4 w-4" />}
          />
        )}
      </div>

      {/* Active filters and results count */}
      {(hasFilters || (filteredCount !== undefined && totalCount !== undefined)) && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Results count */}
          {filteredCount !== undefined && totalCount !== undefined && (
            <span className="text-sm text-muted-foreground">
              {filteredCount === totalCount
                ? `${totalCount} workouts`
                : `${filteredCount} of ${totalCount} workouts`}
            </span>
          )}

          {/* Active filter chips */}
          {filterChips.length > 0 && (
            <>
              <span className="text-muted-foreground">|</span>
              {filterChips.map((chip, index) => (
                <FilterChip key={index} label={chip.label} onRemove={chip.onRemove} />
              ))}
            </>
          )}

          {/* Clear all button */}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-7 px-2">
              <X className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
