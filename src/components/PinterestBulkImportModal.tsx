/**
 * Pinterest Bulk Import Modal
 *
 * Displays when a Pinterest pin contains multiple workouts (e.g., a weekly plan).
 * Allows users to select which workouts to import and saves them to My Workouts.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { WorkoutStructure } from '../types/workout';
import { toast } from 'sonner';

interface PinterestBulkImportModalProps {
  open: boolean;
  onClose: () => void;
  workouts: WorkoutStructure[];
  originalTitle: string;
  sourceUrl: string;
  onImportSelected: (workouts: WorkoutStructure[]) => Promise<void>;
  onEditSingle: (workout: WorkoutStructure) => void;
}

export function PinterestBulkImportModal({
  open,
  onClose,
  workouts,
  originalTitle,
  sourceUrl,
  onImportSelected,
  onEditSingle,
}: PinterestBulkImportModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(workouts.map((_, i) => i))
  );
  const [importing, setImporting] = useState(false);

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(workouts.map((_, i) => i)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const handleImportAll = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one workout to import');
      return;
    }

    setImporting(true);
    try {
      const selectedWorkouts = workouts.filter((_, i) => selectedIds.has(i));
      await onImportSelected(selectedWorkouts);
      toast.success(`Imported ${selectedWorkouts.length} workouts to My Workouts`);
      onClose();
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleEditOne = (workout: WorkoutStructure) => {
    onEditSingle(workout);
    onClose();
  };

  const getExerciseCount = (workout: WorkoutStructure): number => {
    return (workout.blocks || []).reduce(
      (sum, block) => sum + (block.exercises?.length || 0),
      0
    );
  };

  const getWorkoutLabel = (workout: WorkoutStructure): string => {
    const provenance = workout._provenance as any;
    return provenance?.original_block_label || workout.title.split(' - ').pop() || 'Workout';
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-red-600"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
            </svg>
            Multi-Workout Plan Detected
          </DialogTitle>
          <DialogDescription>
            <strong>{originalTitle}</strong> contains {workouts.length} separate workouts.
            Select which ones to import to My Workouts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-between items-center py-2 border-b">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} of {workouts.length} selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={selectNone}>
              Select None
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {workouts.map((workout, index) => {
              const isSelected = selectedIds.has(index);
              const exerciseCount = getExerciseCount(workout);
              const label = getWorkoutLabel(workout);

              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-background hover:bg-muted/50'
                  }`}
                  onClick={() => toggleSelection(index)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelection(index)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{workout.title}</span>
                      <Badge variant="secondary" className="shrink-0">
                        {label}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {exerciseCount} exercises
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditOne(workout);
                    }}
                  >
                    Edit First
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleImportAll}
            disabled={selectedIds.size === 0 || importing}
          >
            {importing ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Importing...
              </>
            ) : (
              <>Import {selectedIds.size} Workout{selectedIds.size !== 1 ? 's' : ''} to My Workouts</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
