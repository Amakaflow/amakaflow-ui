/**
 * ProgramsSection - Manages and displays workout programs
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { WorkoutProgramCard } from './WorkoutProgramCard';
import { CreateProgramModal } from './CreateProgramModal';
import { AddWorkoutToProgramModal } from './AddWorkoutToProgramModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import type { UnifiedWorkout } from '../types/unified-workout';
import type { WorkoutProgram } from '../lib/workout-api';
import {
  getPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  addToProgram,
  removeFromProgram,
} from '../lib/workout-api';
import { isHistoryWorkout, isFollowAlongWorkout } from '../types/unified-workout';

interface ProgramsSectionProps {
  profileId: string;
  workouts: UnifiedWorkout[];
  onLoadWorkout: (workout: UnifiedWorkout) => void;
}

export function ProgramsSection({
  profileId,
  workouts,
  onLoadWorkout,
}: ProgramsSectionProps) {
  const [programs, setPrograms] = useState<WorkoutProgram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<WorkoutProgram | null>(null);
  const [addingToProgram, setAddingToProgram] = useState<WorkoutProgram | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<WorkoutProgram | null>(null);

  // Load programs
  const loadPrograms = useCallback(async () => {
    try {
      const result = await getPrograms(profileId, false);
      setPrograms(result);
    } catch (err) {
      console.error('[ProgramsSection] Error loading programs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  // Create or update program
  const handleSaveProgram = async (data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
  }) => {
    if (editingProgram) {
      // Update existing
      const updated = await updateProgram(editingProgram.id, {
        profile_id: profileId,
        ...data,
      });
      if (updated) {
        setPrograms((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
      }
    } else {
      // Create new
      const created = await createProgram({
        profile_id: profileId,
        ...data,
      });
      if (created) {
        setPrograms((prev) => [created, ...prev]);
      }
    }
    setEditingProgram(null);
    setShowCreateModal(false);
  };

  // Delete program
  const handleDeleteProgram = async () => {
    if (!deletingProgram) return;

    const success = await deleteProgram(deletingProgram.id, profileId);
    if (success) {
      setPrograms((prev) => prev.filter((p) => p.id !== deletingProgram.id));
    }
    setDeletingProgram(null);
  };

  // Add workouts to program
  const handleAddWorkouts = async (workoutIds: string[]) => {
    if (!addingToProgram) return;

    for (const id of workoutIds) {
      const workout = workouts.find((w) => w.id === id);
      if (!workout) continue;

      if (isHistoryWorkout(workout)) {
        await addToProgram(addingToProgram.id, profileId, id, undefined);
      } else if (isFollowAlongWorkout(workout)) {
        await addToProgram(addingToProgram.id, profileId, undefined, id);
      }
    }

    // Reload programs to get updated member lists
    await loadPrograms();
    setAddingToProgram(null);
  };

  // Remove workout from program
  const handleRemoveWorkout = async (programId: string, memberId: string) => {
    const success = await removeFromProgram(programId, memberId, profileId);
    if (success) {
      // Update local state
      setPrograms((prev) =>
        prev.map((p) => {
          if (p.id === programId) {
            return {
              ...p,
              members: p.members?.filter((m) => m.id !== memberId),
            };
          }
          return p;
        })
      );
    }
  };

  // Start next workout in program
  const handleStartNext = async (program: WorkoutProgram) => {
    const currentMember = program.members?.find(
      (m) => m.day_order === program.current_day_index
    );
    if (!currentMember) return;

    const workout = workouts.find(
      (w) =>
        w.id === currentMember.workout_id ||
        w.id === currentMember.follow_along_id
    );
    if (workout) {
      onLoadWorkout(workout);

      // Advance to next day
      const nextDay = program.current_day_index + 1;
      const maxDay = program.members?.length || 0;
      if (nextDay < maxDay) {
        await updateProgram(program.id, {
          profile_id: profileId,
          current_day_index: nextDay,
        });
        setPrograms((prev) =>
          prev.map((p) =>
            p.id === program.id ? { ...p, current_day_index: nextDay } : p
          )
        );
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 hover:opacity-80"
        >
          <FolderOpen className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Programs</h3>
          <span className="text-sm text-muted-foreground">({programs.length})</span>
        </button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditingProgram(null);
            setShowCreateModal(true);
          }}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" />
          New Program
        </Button>
      </div>

      {/* Programs List */}
      {isExpanded && (
        <>
          {programs.length > 0 ? (
            <div className="space-y-2">
              {programs.map((program) => (
                <WorkoutProgramCard
                  key={program.id}
                  program={program}
                  workouts={workouts}
                  onStartNext={() => handleStartNext(program)}
                  onEdit={() => {
                    setEditingProgram(program);
                    setShowCreateModal(true);
                  }}
                  onDelete={() => setDeletingProgram(program)}
                  onAddWorkout={() => setAddingToProgram(program)}
                  onRemoveWorkout={(memberId) =>
                    handleRemoveWorkout(program.id, memberId)
                  }
                  onLoadWorkout={onLoadWorkout}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 border rounded-lg bg-muted/20">
              <FolderOpen className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm mb-3">
                No programs yet. Create one to group related workouts.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setEditingProgram(null);
                  setShowCreateModal(true);
                }}
                className="gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Create Program
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Program Modal */}
      <CreateProgramModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingProgram(null);
        }}
        onSave={handleSaveProgram}
        editingProgram={editingProgram}
      />

      {/* Add Workout to Program Modal */}
      {addingToProgram && (
        <AddWorkoutToProgramModal
          isOpen={true}
          onClose={() => setAddingToProgram(null)}
          program={addingToProgram}
          workouts={workouts}
          onAdd={handleAddWorkouts}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingProgram}
        onOpenChange={() => setDeletingProgram(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Program?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete "{deletingProgram?.name}" and remove all workout
              associations. The workouts themselves will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProgram}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ProgramsSection;
