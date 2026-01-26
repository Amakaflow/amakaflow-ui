/**
 * ProgramsFilterBar - Status tabs and sort dropdown
 */

import { ArrowUpDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export type StatusFilter = 'all' | 'active' | 'draft' | 'completed';
export type SortBy = 'updated_at' | 'name' | 'progress';

interface ProgramsFilterBarProps {
  statusFilter: StatusFilter;
  sortBy: SortBy;
  onStatusChange: (status: StatusFilter) => void;
  onSortChange: (sort: SortBy) => void;
  counts: {
    all: number;
    active: number;
    draft: number;
    completed: number;
  };
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'updated_at', label: 'Most Recent' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'progress', label: 'Progress' },
];

export function ProgramsFilterBar({
  statusFilter,
  sortBy,
  onStatusChange,
  onSortChange,
  counts,
}: ProgramsFilterBarProps) {
  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Sort';

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      {/* Status tabs - scrollable on mobile */}
      <div className="w-full sm:w-auto overflow-x-auto">
        <Tabs
          value={statusFilter}
          onValueChange={(value) => onStatusChange(value as StatusFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">
              All
              <span className="ml-1.5 text-xs opacity-70">({counts.all})</span>
            </TabsTrigger>
            <TabsTrigger value="active">
              Active
              <span className="ml-1.5 text-xs opacity-70">({counts.active})</span>
            </TabsTrigger>
            <TabsTrigger value="draft">
              Draft
              <span className="ml-1.5 text-xs opacity-70">({counts.draft})</span>
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed
              <span className="ml-1.5 text-xs opacity-70">({counts.completed})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Sort dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 shrink-0">
            <ArrowUpDown className="w-4 h-4" />
            {currentSortLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={sortBy}
            onValueChange={(value) => onSortChange(value as SortBy)}
          >
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default ProgramsFilterBar;
