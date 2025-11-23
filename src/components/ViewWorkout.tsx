import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { X, Clock, Watch, Bike, Dumbbell, Trash2 } from 'lucide-react';
import { WorkoutHistoryItem } from '../lib/workout-history';
import { Block, Exercise } from '../types/workout';
import { getDeviceById, DeviceId } from '../lib/devices';

type Props = {
  workout: WorkoutHistoryItem;
  onClose: () => void;
};

// Helper function to get device icon
function getDeviceIcon(device: string) {
  switch (device) {
    case 'garmin':
    case 'apple':
      return <Watch className="w-4 h-4" />;
    case 'zwift':
      return <Bike className="w-4 h-4" />;
    default:
      return <Dumbbell className="w-4 h-4" />;
  }
}

// Helper function to get device name
function getDeviceName(device: string): string {
  switch (device) {
    case 'garmin':
      return 'Garmin';
    case 'apple':
      return 'Apple';
    case 'zwift':
      return 'Zwift';
    default:
      return device;
  }
}

// Helper function to format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
}

// Helper function to get exercise measurement display
function getExerciseMeasurement(exercise: Exercise): string {
  if (exercise.distance_m) {
    return `${exercise.distance_m}m`;
  }
  if (exercise.distance_range) {
    return exercise.distance_range;
  }
  if (exercise.reps) {
    return `${exercise.reps} reps`;
  }
  if (exercise.reps_range) {
    return `${exercise.reps_range} reps`;
  }
  if (exercise.duration_sec) {
    const minutes = Math.round(exercise.duration_sec / 60);
    return `${minutes} min`;
  }
  return '';
}

export function ViewWorkout({ workout, onClose }: Props) {
  const workoutData = workout.workout;
  const blocks = workoutData?.blocks || [];
  const hasExports = !!(workout.exports);

  // Flatten all exercises from all blocks and supersets into a single list
  const allExercises: Array<{ exercise: Exercise; letter: string }> = [];
  let letterIndex = 0;

  blocks.forEach((block: Block) => {
    // Add block-level exercises
    if (block.exercises && block.exercises.length > 0) {
      block.exercises.forEach((exercise: Exercise) => {
        const letter = String.fromCharCode(65 + letterIndex); // A, B, C, etc.
        allExercises.push({ exercise, letter });
        letterIndex++;
      });
    }

    // Add superset exercises
    if (block.supersets && block.supersets.length > 0) {
      block.supersets.forEach((superset) => {
        if (superset.exercises && superset.exercises.length > 0) {
          superset.exercises.forEach((exercise: Exercise) => {
            const letter = String.fromCharCode(65 + letterIndex);
            allExercises.push({ exercise, letter });
            letterIndex++;
          });
        }
      });
    }
  });

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section (Fixed) */}
        <CardHeader className="border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-2xl">{workoutData?.title || 'Untitled Workout'}</CardTitle>
                <Badge variant={hasExports ? 'default' : 'secondary'}>
                  {hasExports ? 'Ready' : 'Draft'}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>{formatDate(workout.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {getDeviceIcon(workout.device)}
                  <span>{getDeviceName(workout.device)}</span>
                </div>
                <div>
                  <span>{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
                  {allExercises.length > 0 && (
                    <span className="ml-2">
                      • {allExercises.length} exercise{allExercises.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        {/* Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6">
          {allExercises.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No exercises found in this workout</p>
            </div>
          ) : (
            <div className="space-y-1">
              {allExercises.map((item, idx) => {
                const { exercise, letter } = item;
                const measurement = getExerciseMeasurement(exercise);
                const exerciseType = exercise.type || '';

                return (
                  <div
                    key={exercise.id || idx}
                    className="flex items-center gap-3 p-3 border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    {/* Letter prefix */}
                    <div className="font-semibold text-sm text-muted-foreground w-6 shrink-0">
                      {letter}.
                    </div>

                    {/* Exercise name */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{exercise.name}</div>
                    </div>

                    {/* Measurement and type badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      {measurement && (
                        <Badge variant="outline" className="text-xs">
                          {measurement}
                        </Badge>
                      )}
                      {exerciseType && (
                        <Badge variant="outline" className="text-xs">
                          {exerciseType}
                        </Badge>
                      )}
                    </div>

                    {/* Trash icon (read-only, so we can hide it or make it non-functional) */}
                    <div className="w-6 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
