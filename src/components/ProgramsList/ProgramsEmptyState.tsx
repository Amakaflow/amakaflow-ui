/**
 * ProgramsEmptyState - Empty state component for different filter states
 */

import { FolderOpen, Sparkles, CheckCircle2, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import type { StatusFilter } from './ProgramsFilterBar';

interface ProgramsEmptyStateProps {
  statusFilter: StatusFilter;
  onCreateProgram: () => void;
  onViewDrafts?: () => void;
}

const EMPTY_STATES: Record<
  StatusFilter,
  {
    icon: typeof FolderOpen;
    title: string;
    description: string;
    action: string | null;
    actionVariant?: 'primary' | 'secondary';
  }
> = {
  all: {
    icon: FolderOpen,
    title: 'No programs yet',
    description: 'Create your first training program to start tracking your fitness journey.',
    action: 'Create Program',
    actionVariant: 'primary',
  },
  active: {
    icon: Sparkles,
    title: 'No active programs',
    description: 'Activate a draft program or create a new one to get started.',
    action: 'View Drafts',
    actionVariant: 'secondary',
  },
  draft: {
    icon: FileText,
    title: 'No draft programs',
    description: 'All your programs are either active or completed.',
    action: 'Create Program',
    actionVariant: 'primary',
  },
  completed: {
    icon: CheckCircle2,
    title: 'No completed programs',
    description: 'Complete an active program to see it here.',
    action: null,
  },
};

export function ProgramsEmptyState({
  statusFilter,
  onCreateProgram,
  onViewDrafts,
}: ProgramsEmptyStateProps) {
  const state = EMPTY_STATES[statusFilter];
  const Icon = state.icon;

  const handleAction = () => {
    if (statusFilter === 'active' && onViewDrafts) {
      onViewDrafts();
    } else {
      onCreateProgram();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{state.title}</h3>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        {state.description}
      </p>
      {state.action && (
        <Button
          onClick={handleAction}
          variant={state.actionVariant === 'secondary' ? 'outline' : 'default'}
        >
          {state.action}
        </Button>
      )}
    </div>
  );
}

export default ProgramsEmptyState;
