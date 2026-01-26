/**
 * WorkoutCard - Preview card for a workout in the weekly calendar
 */

import { Check, Clock, Dumbbell } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import type { ProgramWorkout } from '../../types/training-program';
import { WORKOUT_TYPE_COLORS } from '../../types/training-program';

interface WorkoutCardProps {
  workout: ProgramWorkout;
  onClick: () => void;
  isSelected?: boolean;
}

export function WorkoutCard({ workout, onClick, isSelected }: WorkoutCardProps) {
  const borderColor =
    WORKOUT_TYPE_COLORS[workout.workout_type.toLowerCase()] ||
    WORKOUT_TYPE_COLORS.default;

  const exerciseCount = workout.exercises.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={`${workout.name}${workout.is_completed ? ', completed' : ''}`}
      className={cn(
        'p-3 cursor-pointer transition-all hover:shadow-md border-l-4 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        borderColor,
        isSelected && 'ring-2 ring-primary',
        workout.is_completed && 'bg-muted/50'
      )}
    >
      <div className="space-y-2">
        {/* Header with name and completion status */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm leading-tight line-clamp-2">
            {workout.name}
          </h4>
          {workout.is_completed && (
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Workout type badge */}
        <Badge variant="secondary" className="text-xs capitalize">
          {workout.workout_type.replace('_', ' ')}
        </Badge>

        {/* Metadata row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Dumbbell className="w-3 h-3" />
            <span>{exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}</span>
          </div>
          {workout.target_duration_minutes && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{workout.target_duration_minutes} min</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Empty cell placeholder for rest days
 */
export function RestDayCell() {
  return (
    <div className="h-full min-h-[100px] flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-lg bg-muted/20">
      Rest Day
    </div>
  );
}
