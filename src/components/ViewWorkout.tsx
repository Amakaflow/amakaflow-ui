import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { X, Clock, Watch, Bike, Dumbbell } from 'lucide-react';
import { WorkoutHistoryItem } from '../lib/workout-history';
import { Block, Exercise } from '../types/workout';
import { getDeviceById, DeviceId } from '../lib/devices';
import { getStructureDisplayName } from '../lib/workout-utils';

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

// Helper function to get block structure info string
function getBlockStructureInfo(block: Block): string {
  const parts: string[] = [];
  
  // Count total exercises in block (block-level + supersets)
  const blockExercises = (block.exercises || []).length;
  const supersetExercises = (block.supersets || []).reduce(
    (sum, ss) => sum + (ss.exercises?.length || 0),
    0
  );
  const totalExercises = blockExercises + supersetExercises;
  
  // Add rounds if present
  if (block.rounds) {
    parts.push(`${block.rounds} rounds`);
  }
  
  // Add exercises count
  if (totalExercises > 0) {
    parts.push(`${totalExercises} exercise${totalExercises !== 1 ? 's' : ''}`);
  }
  
  // Add sets if present
  if (block.sets) {
    parts.push(`${block.sets} sets`);
  }
  
  // Add rest periods
  if (block.rest_between_rounds_sec) {
    parts.push(`${block.rest_between_rounds_sec}s rest`);
  } else if (block.rest_between_sets_sec) {
    parts.push(`${block.rest_between_sets_sec}s rest`);
  }
  
  return parts.length > 0 ? parts.join(' • ') : '';
}

// Helper function to count total exercises in a block
function countBlockExercises(block: Block): number {
  const blockExercises = (block.exercises || []).length;
  const supersetExercises = (block.supersets || []).reduce(
    (sum, ss) => sum + (ss.exercises?.length || 0),
    0
  );
  return blockExercises + supersetExercises;
}

export function ViewWorkout({ workout, onClose }: Props) {
  const workoutData = workout.workout;
  const blocks = workoutData?.blocks || [];
  const hasExports = !!(workout.exports);

  // Count total exercises across all blocks
  const totalExercises = blocks.reduce((sum, block) => sum + countBlockExercises(block), 0);

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
                  {totalExercises > 0 && (
                    <span className="ml-2">
                      • {totalExercises} exercise{totalExercises !== 1 ? 's' : ''}
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
          {blocks.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No blocks found in this workout</p>
            </div>
          ) : (
            <div className="space-y-4">
              {blocks.map((block, blockIdx) => {
                const blockExercises = block.exercises || [];
                const blockSupersets = block.supersets || [];
                const totalBlockExercises = countBlockExercises(block);
                const structureInfo = getBlockStructureInfo(block);

                return (
                  <div
                    key={block.id || blockIdx}
                    className="bg-muted/30 rounded-lg border border-border p-4 space-y-3"
                  >
                    {/* Block Header */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base">{block.label || `Block ${blockIdx + 1}`}</h3>
                        {block.structure && (
                          <Badge variant="outline" className="text-xs">
                            {getStructureDisplayName(block.structure)}
                          </Badge>
                        )}
                      </div>
                      {structureInfo && (
                        <p className="text-sm text-muted-foreground">
                          Structure: {structureInfo}
                        </p>
                      )}
                    </div>

                    {/* Block-level exercises */}
                    {blockExercises.length > 0 && (
                      <div className="space-y-2">
                        {blockExercises.map((exercise, exerciseIdx) => {
                          const measurement = getExerciseMeasurement(exercise);
                          const exerciseType = exercise.type || '';

                          return (
                            <div
                              key={exercise.id || exerciseIdx}
                              className="bg-background rounded-md border border-border/50 p-3 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">{exercise.name}</div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {measurement && (
                                    <Badge variant="outline" className="text-xs">
                                      {measurement}
                                    </Badge>
                                  )}
                                  {exerciseType && (
                                    <Badge variant="secondary" className="text-xs">
                                      {exerciseType}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Superset exercises */}
                    {blockSupersets.length > 0 && (
                      <div className="space-y-3">
                        {blockSupersets.map((superset, supersetIdx) => {
                          const supersetExercises = superset.exercises || [];
                          
                          return (
                            <div key={superset.id || supersetIdx} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  Superset {supersetIdx + 1}
                                </Badge>
                                {superset.rest_between_sec && (
                                  <span className="text-xs text-muted-foreground">
                                    {superset.rest_between_sec}s rest
                                  </span>
                                )}
                              </div>
                              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                                {supersetExercises.map((exercise, exerciseIdx) => {
                                  const measurement = getExerciseMeasurement(exercise);
                                  const exerciseType = exercise.type || '';

                                  return (
                                    <div
                                      key={exercise.id || exerciseIdx}
                                      className="bg-background rounded-md border border-border/50 p-3 hover:bg-muted/50 transition-colors"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-sm">{exercise.name}</div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          {measurement && (
                                            <Badge variant="outline" className="text-xs">
                                              {measurement}
                                            </Badge>
                                          )}
                                          {exerciseType && (
                                            <Badge variant="secondary" className="text-xs">
                                              {exerciseType}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Empty state for block */}
                    {totalBlockExercises === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-4">
                        No exercises in this block
                      </div>
                    )}
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
