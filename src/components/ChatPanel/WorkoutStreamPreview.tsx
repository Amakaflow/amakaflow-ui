import { Dumbbell, Clock } from 'lucide-react';
import { ExerciseCard } from './ExerciseCard';
import { ExerciseCardSkeleton } from './ExerciseCardSkeleton';
import type { GeneratedWorkout, WorkoutSearchResults } from '../../types/chat';
import { cn } from '../ui/utils';

interface WorkoutStreamPreviewProps {
  workoutData?: GeneratedWorkout | null;
  searchResults?: WorkoutSearchResults | null;
  isGenerating?: boolean;
}

export function WorkoutStreamPreview({
  workoutData,
  searchResults,
  isGenerating,
}: WorkoutStreamPreviewProps) {
  // Show skeleton during generation with no data yet
  if (isGenerating && !workoutData && !searchResults) {
    return (
      <div className="mt-2 mb-1" data-testid="workout-stream-preview">
        <ExerciseCardSkeleton count={3} />
      </div>
    );
  }

  // Show generated workout with exercise cards
  if (workoutData) {
    const { workout } = workoutData;
    return (
      <div className="mt-2 mb-1 space-y-2" data-testid="workout-stream-preview">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Dumbbell className="w-4 h-4 text-primary" />
          <span>{workout.name}</span>
          {workout.duration_minutes && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {workout.duration_minutes} min
            </span>
          )}
          {workout.difficulty && (
            <span className="text-xs text-muted-foreground capitalize">
              · {workout.difficulty}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {workout.exercises.map((ex, i) => (
            <ExerciseCard key={`${ex.name}-${i}`} exercise={ex} animateIn index={i} />
          ))}
        </div>
      </div>
    );
  }

  // Show search results as compact cards
  if (searchResults && searchResults.workouts.length > 0) {
    return (
      <div className="mt-2 mb-1 space-y-1.5" data-testid="workout-stream-preview">
        {searchResults.workouts.map((w, i) => (
          <div
            key={w.workout_id}
            className={cn(
              'flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2',
              'animate-in fade-in-0 slide-in-from-bottom-2',
            )}
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
            data-testid="search-result-card"
          >
            <Dumbbell className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{w.title}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {w.exercise_count != null && <span>{w.exercise_count} exercises</span>}
                {w.duration_minutes != null && (
                  <>
                    <span>·</span>
                    <span>{w.duration_minutes} min</span>
                  </>
                )}
                {w.difficulty && (
                  <>
                    <span>·</span>
                    <span className="capitalize">{w.difficulty}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
