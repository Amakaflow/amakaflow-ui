/**
 * ProgramsSection - Manages and displays workout programs
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, FolderOpen, Loader2, Sparkles, Eye, Calendar, Dumbbell, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { WorkoutProgramCard } from './WorkoutProgramCard';
import { CreateProgramModal } from './CreateProgramModal';
import { AddWorkoutToProgramModal } from './AddWorkoutToProgramModal';
import { ProgramWizard } from './ProgramWizard';
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
import type { TrainingProgram } from '../types/training-program';
import { STATUS_LABELS } from '../types/training-program';
import {
  getPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  addToProgram,
  removeFromProgram,
} from '../lib/workout-api';
import { getTrainingPrograms } from '../lib/training-program-api';
import { isHistoryWorkout, isFollowAlongWorkout } from '../types/unified-workout';

interface ProgramsSectionProps {
  profileId: string;
  workouts: UnifiedWorkout[];
  onLoadWorkout: (workout: UnifiedWorkout) => void;
  onViewProgram?: (programId: string) => void;
  onAddToCalendar?: (program: TrainingProgram) => void;
}

export function ProgramsSection({
  profileId,
  workouts,
  onLoadWorkout,
  onViewProgram,
  onAddToCalendar,
}: ProgramsSectionProps) {
  const [programs, setPrograms] = useState<WorkoutProgram[]>([]);
  const [trainingPrograms, setTrainingPrograms] = useState<TrainingProgram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGenerateWizard, setShowGenerateWizard] = useState(false);
  const [editingProgram, setEditingProgram] = useState<WorkoutProgram | null>(null);
  const [addingToProgram, setAddingToProgram] = useState<WorkoutProgram | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<WorkoutProgram | null>(null);

  // Load programs (both manual and AI-generated)
  const loadPrograms = useCallback(async () => {
    try {
      const [manualPrograms, aiPrograms] = await Promise.all([
        getPrograms(profileId, false),
        getTrainingPrograms(profileId, false),
      ]);
      setPrograms(manualPrograms);
      setTrainingPrograms(aiPrograms);
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
          <span className="text-sm text-muted-foreground">
            ({programs.length + trainingPrograms.length})
          </span>
        </button>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowGenerateWizard(true)}
            className="gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            Generate Program
          </Button>
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
      </div>

      {/* Programs List */}
      {isExpanded && (
        <>
          {/* AI-Generated Training Programs */}
          {trainingPrograms.length > 0 && (
            <div className="space-y-2 mb-4">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4" />
                AI-Generated Programs
              </h4>
              {trainingPrograms.map((program) => (
                <TrainingProgramCard
                  key={program.id}
                  program={program}
                  onView={() => onViewProgram?.(program.id)}
                  onAddToCalendar={onAddToCalendar || (() => {})}
                />
              ))}
            </div>
          )}

          {/* Manual Workout Programs */}
          {programs.length > 0 && (
            <>
              {trainingPrograms.length > 0 && (
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2 mt-4">
                  <FolderOpen className="w-4 h-4" />
                  Workout Collections
                </h4>
              )}
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
            </>
          )}

          {/* Empty state */}
          {programs.length === 0 && trainingPrograms.length === 0 && (
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

      {/* Program Generation Wizard */}
      <ProgramWizard
        userId={profileId}
        isOpen={showGenerateWizard}
        onClose={() => setShowGenerateWizard(false)}
        onComplete={() => {
          setShowGenerateWizard(false);
          loadPrograms();
        }}
      />
    </div>
  );
}

/**
 * TrainingProgramCard - Compact card for AI-generated training programs
 */
interface TrainingProgramCardProps {
  program: TrainingProgram;
  onView: () => void;
  onAddToCalendar: (program: TrainingProgram) => void;
}

function TrainingProgramCard({ program, onView, onAddToCalendar }: TrainingProgramCardProps) {
  const progress = Math.round(
    ((program.current_week - 1) / program.duration_weeks) * 100
  );

  return (
    <Card
      className="p-3 cursor-pointer hover:bg-muted/50 transition-colors border-l-4 border-l-primary"
      onClick={onView}
    >
      <div className="flex items-center gap-3">
        {/* Program icon */}
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>

        {/* Program info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold truncate">{program.name}</h4>
            <Badge className={STATUS_LABELS[program.status].color}>
              {STATUS_LABELS[program.status].label}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {program.duration_weeks} weeks
            </span>
            <span className="flex items-center gap-1">
              <Dumbbell className="w-3 h-3" />
              {program.sessions_per_week}/week
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {program.time_per_session_minutes} min
            </span>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full max-w-[150px]">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              Week {program.current_week} of {program.duration_weeks}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCalendar(program);
            }}
            className="gap-1.5"
          >
            <Calendar className="w-4 h-4" />
            Add to Calendar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="gap-1.5"
          >
            <Eye className="w-4 h-4" />
            View Plan
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default ProgramsSection;
