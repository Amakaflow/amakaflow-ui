import { Dumbbell } from 'lucide-react';
import type { WorkoutExercise } from '../../types/chat';
import { cn } from '../ui/utils';

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  animateIn?: boolean;
  index?: number;
}

export function ExerciseCard({ exercise, animateIn, index = 0 }: ExerciseCardProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5',
        'transition-all duration-300',
        animateIn && 'animate-in fade-in-0 slide-in-from-bottom-2',
      )}
      style={animateIn ? { animationDelay: `${index * 80}ms`, animationFillMode: 'both' } : undefined}
      data-testid="exercise-card"
    >
      <div className="mt-0.5 rounded-md bg-primary/10 p-1.5">
        <Dumbbell className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm leading-tight">{exercise.name}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {exercise.sets != null && <span>{exercise.sets} sets</span>}
          {exercise.sets != null && exercise.reps && <span>&middot;</span>}
          {exercise.reps && <span>{exercise.reps} reps</span>}
          {exercise.muscle_group && (
            <>
              <span>&middot;</span>
              <span className="capitalize">{exercise.muscle_group}</span>
            </>
          )}
        </div>
        {exercise.notes && (
          <p className="mt-1 text-xs text-muted-foreground/80 italic">{exercise.notes}</p>
        )}
      </div>
    </div>
  );
}
