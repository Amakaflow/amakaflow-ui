/**
 * ProgramsList - Main container for the programs list page
 * Handles fetching, filtering, sorting, and displaying programs
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { ProgramsHeader } from './ProgramsHeader';
import { ProgramsFilterBar, type StatusFilter, type SortBy } from './ProgramsFilterBar';
import { ProgramCard } from './ProgramCard';
import { ProgramsEmptyState } from './ProgramsEmptyState';
import { ProgramsLoadingSkeleton } from './ProgramsLoadingSkeleton';
import { ProgramWizard } from '../ProgramWizard';
import {
  getTrainingPrograms,
  updateProgramStatus,
  deleteTrainingProgram,
} from '../../lib/training-program-api';
import type { TrainingProgram, ProgramStatus } from '../../types/training-program';

interface ProgramsListProps {
  userId: string;
  onViewProgram: (programId: string) => void;
}

export function ProgramsList({ userId, onViewProgram }: ProgramsListProps) {
  // Data state
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter/sort state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('updated_at');

  // Modal state
  const [showWizard, setShowWizard] = useState(false);

  // Track loading state per card action
  const [loadingActions, setLoadingActions] = useState<Record<string, string>>({});

  // Fetch programs
  const loadPrograms = useCallback(async () => {
    try {
      setError(null);
      const data = await getTrainingPrograms(userId, true); // Include archived
      setPrograms(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load programs';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  // Calculate counts for each status
  const counts = useMemo(() => {
    const result = { all: 0, active: 0, draft: 0, completed: 0 };
    programs.forEach((p) => {
      result.all++;
      if (p.status === 'active' || p.status === 'paused') {
        result.active++;
      } else if (p.status === 'draft') {
        result.draft++;
      } else if (p.status === 'completed') {
        result.completed++;
      }
    });
    return result;
  }, [programs]);

  // Filter and sort programs
  const filteredPrograms = useMemo(() => {
    let filtered = [...programs];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => {
        if (statusFilter === 'active') {
          return p.status === 'active' || p.status === 'paused';
        }
        return p.status === statusFilter;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'progress': {
          // Calculate progress with clamping to avoid edge cases
          const getProgress = (p: TrainingProgram) => {
            if (p.duration_weeks === 0) return 0;
            return Math.max(0, Math.min(1, (p.current_week - 1) / p.duration_weeks));
          };
          return getProgress(b) - getProgress(a); // Higher progress first
        }
        case 'updated_at':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return filtered;
  }, [programs, statusFilter, sortBy]);

  // Helper to set/clear loading action
  const setActionLoading = (programId: string, action: string | null) => {
    if (action) {
      setLoadingActions((prev) => ({ ...prev, [programId]: action }));
    } else {
      setLoadingActions((prev) => {
        const { [programId]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  // Handle status updates with optimistic updates and rollback
  const handleActivate = async (programId: string) => {
    const originalPrograms = programs;
    setActionLoading(programId, 'activate');

    // Optimistic update
    setPrograms((prev) =>
      prev.map((p) =>
        p.id === programId
          ? { ...p, status: 'active' as ProgramStatus, started_at: new Date().toISOString() }
          : p
      )
    );

    try {
      const success = await updateProgramStatus(programId, userId, 'active');
      if (success) {
        toast.success('Program activated');
      } else {
        setPrograms(originalPrograms); // Rollback
        toast.error('Failed to activate program');
      }
    } catch (err) {
      setPrograms(originalPrograms); // Rollback
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Activate failed:', err);
      toast.error(`Failed to activate program: ${message}`);
    } finally {
      setActionLoading(programId, null);
    }
  };

  const handlePause = async (programId: string) => {
    const originalPrograms = programs;
    setActionLoading(programId, 'pause');

    // Optimistic update
    setPrograms((prev) =>
      prev.map((p) =>
        p.id === programId ? { ...p, status: 'paused' as ProgramStatus } : p
      )
    );

    try {
      const success = await updateProgramStatus(programId, userId, 'paused');
      if (success) {
        toast.success('Program paused');
      } else {
        setPrograms(originalPrograms); // Rollback
        toast.error('Failed to pause program');
      }
    } catch (err) {
      setPrograms(originalPrograms); // Rollback
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Pause failed:', err);
      toast.error(`Failed to pause program: ${message}`);
    } finally {
      setActionLoading(programId, null);
    }
  };

  const handleDelete = async (programId: string) => {
    const originalPrograms = programs;
    setActionLoading(programId, 'delete');

    // Optimistic update
    setPrograms((prev) => prev.filter((p) => p.id !== programId));

    try {
      const success = await deleteTrainingProgram(programId, userId);
      if (success) {
        toast.success('Program deleted');
      } else {
        setPrograms(originalPrograms); // Rollback
        toast.error('Failed to delete program');
      }
    } catch (err) {
      setPrograms(originalPrograms); // Rollback
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Delete failed:', err);
      toast.error(`Failed to delete program: ${message}`);
    } finally {
      setActionLoading(programId, null);
    }
  };

  // Handle view drafts from empty state
  const handleViewDrafts = () => {
    setStatusFilter('draft');
  };

  // Handle program creation
  const handleCreateProgram = () => {
    setShowWizard(true);
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    loadPrograms();
  };

  if (isLoading) {
    return (
      <div>
        <ProgramsHeader
          totalCount={0}
          onCreateProgram={handleCreateProgram}
        />
        <ProgramsFilterBar
          statusFilter={statusFilter}
          sortBy={sortBy}
          onStatusChange={setStatusFilter}
          onSortChange={setSortBy}
          counts={{ all: 0, active: 0, draft: 0, completed: 0 }}
        />
        <ProgramsLoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-destructive mb-4">{error}</p>
        <Button
          onClick={() => {
            setIsLoading(true);
            loadPrograms();
          }}
          variant="outline"
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div>
      <ProgramsHeader
        totalCount={programs.length}
        onCreateProgram={handleCreateProgram}
      />

      <ProgramsFilterBar
        statusFilter={statusFilter}
        sortBy={sortBy}
        onStatusChange={setStatusFilter}
        onSortChange={setSortBy}
        counts={counts}
      />

      {filteredPrograms.length === 0 ? (
        <ProgramsEmptyState
          statusFilter={statusFilter}
          onCreateProgram={handleCreateProgram}
          onViewDrafts={handleViewDrafts}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              loadingAction={loadingActions[program.id]}
              onView={() => onViewProgram(program.id)}
              onActivate={() => handleActivate(program.id)}
              onPause={() => handlePause(program.id)}
              onDelete={() => handleDelete(program.id)}
            />
          ))}
        </div>
      )}

      {/* Program Generation Wizard */}
      <ProgramWizard
        userId={userId}
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={handleWizardComplete}
      />
    </div>
  );
}

export default ProgramsList;
