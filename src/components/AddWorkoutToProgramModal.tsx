/**
 * AddWorkoutToProgramModal - Select workouts to add to a program
 */

import React, { useState, useMemo } from 'react';
import { X, Search, Check, Video } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import type { UnifiedWorkout } from '../types/unified-workout';
import type { WorkoutProgram } from '../lib/workout-api';

interface AddWorkoutToProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  program: WorkoutProgram;
  workouts: UnifiedWorkout[];
  onAdd: (workoutIds: string[]) => Promise<void>;
}

export function AddWorkoutToProgramModal({
  isOpen,
  onClose,
  program,
  workouts,
  onAdd,
}: AddWorkoutToProgramModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Filter out workouts already in the program
  const existingWorkoutIds = useMemo(() => {
    return new Set(
      program.members?.map((m) => m.workout_id || m.follow_along_id) || []
    );
  }, [program.members]);

  // Filter workouts by search and exclude already-added
  const filteredWorkouts = useMemo(() => {
    return workouts.filter((w) => {
      // Exclude already in program
      if (existingWorkoutIds.has(w.id)) return false;

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          w.title.toLowerCase().includes(query) ||
          w.searchableText.includes(query)
        );
      }

      return true;
    });
  }, [workouts, existingWorkoutIds, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAdd = async () => {
    if (selectedIds.length === 0) return;

    setIsSaving(true);
    try {
      await onAdd(selectedIds);
      setSelectedIds([]);
      onClose();
    } catch (err) {
      console.error('Failed to add workouts to program:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-lg mx-4 border max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Add to Program</h2>
            <p className="text-sm text-muted-foreground">{program.name}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workouts..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Workout List */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2">
            {filteredWorkouts.length > 0 ? (
              <div className="space-y-1">
                {filteredWorkouts.map((workout) => {
                  const isSelected = selectedIds.includes(workout.id);
                  const isVideo = workout._original.type === 'follow-along';

                  return (
                    <button
                      key={workout.id}
                      onClick={() => toggleSelect(workout.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground/30'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>

                      {/* Thumbnail */}
                      {isVideo && workout.thumbnailUrl && (
                        <div className="w-12 h-9 rounded overflow-hidden flex-shrink-0 bg-muted">
                          <img
                            src={workout.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{workout.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{workout.exerciseCount} exercises</span>
                          {isVideo && (
                            <Badge variant="secondary" className="text-xs gap-1 py-0">
                              <Video className="w-3 h-3" />
                              Video
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">
                  {searchQuery
                    ? 'No workouts match your search'
                    : 'All workouts are already in this program'}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t flex-shrink-0">
          <p className="text-sm text-muted-foreground">
            {selectedIds.length} workout{selectedIds.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={selectedIds.length === 0 || isSaving}
            >
              {isSaving ? 'Adding...' : `Add ${selectedIds.length > 0 ? selectedIds.length : ''} Workout${selectedIds.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddWorkoutToProgramModal;
