/**
 * Searchable exercise selector using Command (cmdk).
 *
 * Part of AMA-481: Build Exercise History Page with 1RM Trends
 */

import { useState } from 'react';
import { Check, ChevronsUpDown, Dumbbell } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import type { ExerciseWithHistory } from '../../hooks/useProgressionApi';

interface ExerciseSelectorProps {
  exercises: ExerciseWithHistory[] | undefined;
  selectedExerciseId: string | null;
  onSelect: (exerciseId: string) => void;
  isLoading?: boolean;
}

export function ExerciseSelector({
  exercises,
  selectedExerciseId,
  onSelect,
  isLoading,
}: ExerciseSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedExercise = exercises?.find(
    (e) => e.exerciseId === selectedExerciseId
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[300px] justify-between"
          disabled={isLoading}
          data-testid="exercise-selector-trigger"
        >
          {isLoading ? (
            <span className="text-muted-foreground">Loading exercises...</span>
          ) : selectedExercise ? (
            <span className="flex items-center gap-2 truncate">
              <Dumbbell className="w-4 h-4 shrink-0" />
              <span className="truncate">{selectedExercise.exerciseName}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select an exercise...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start" data-testid="exercise-selector-popover">
        <Command>
          <CommandInput placeholder="Search exercises..." data-testid="exercise-selector-search" />
          <CommandList>
            <CommandEmpty data-testid="exercise-selector-empty">No exercises found.</CommandEmpty>
            <CommandGroup>
              {exercises?.map((exercise) => (
                <CommandItem
                  key={exercise.exerciseId}
                  value={exercise.exerciseName}
                  onSelect={() => {
                    onSelect(exercise.exerciseId);
                    setOpen(false);
                  }}
                  data-testid={`exercise-selector-item-${exercise.exerciseId}`}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedExerciseId === exercise.exerciseId
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  <div className="flex items-center justify-between w-full">
                    <span className="truncate">{exercise.exerciseName}</span>
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      {exercise.sessionCount} session{exercise.sessionCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
