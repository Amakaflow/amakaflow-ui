import { useEffect } from 'react';
import { Card, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { X, Clock, Watch, Bike, Dumbbell } from 'lucide-react';
import { WorkoutHistoryItem } from '../lib/workout-history';
import { Block, Exercise } from '../types/workout';
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
  const workoutData = workout.workout || workout.data || workout;
  const blocks = workoutData?.blocks || [];
  const hasExports = !!(workout.exports);

  // Count total exercises across all blocks
  const totalExercises = blocks.reduce((sum, block) => sum + countBlockExercises(block), 0);
  
  // Helper to format block metadata
  const getBlockMetadata = (block: Block): string => {
    const parts: string[] = [];
    const blockExerciseCount = countBlockExercises(block);
    
    if (block.structure) {
      parts.push(`Structure: ${getStructureDisplayName(block.structure)}`);
    }
    if (blockExerciseCount > 0) {
      parts.push(`${blockExerciseCount} exercise${blockExerciseCount !== 1 ? 's' : ''}`);
    }
    if (block.sets) {
      parts.push(`${block.sets} sets`);
    }
    if (block.rest_between_rounds_sec) {
      parts.push(`${block.rest_between_rounds_sec}s rest`);
    } else if (block.rest_between_sets_sec) {
      parts.push(`${block.rest_between_sets_sec}s rest`);
    }
    
    return parts.join(' • ');
  };

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

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-background rounded-lg shadow-lg w-full max-w-4xl flex flex-col"
        style={{
          maxHeight: '90vh',
          height: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="border-b px-6 py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-2xl">
                  {workoutData?.title || workout.title || 'Untitled Workout'}
                </CardTitle>
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
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="h-9 w-9 flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div
          className="flex-1 overflow-y-auto px-6 py-4"
          style={{
            minHeight: 0,
          }}
        >
          {blocks.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No blocks found in this workout</p>
            </div>
          ) : (
            <div className="space-y-6">
              {blocks.map((block, blockIdx) => {
                const blockExercises = block.exercises || [];
                const blockSupersets = block.supersets || [];
                const blockMetadata = getBlockMetadata(block);

                return (
                  <div
                    key={block.id || blockIdx}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* Block Header */}
                    <div className="bg-muted px-4 py-3 border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">
                            {block.label || block.name || block.type || `Block ${blockIdx + 1}`}
                          </h3>
                          {blockMetadata && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {blockMetadata}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Block Content */}
                    <div className="p-4 space-y-4 bg-background">
                      {/* Block-level exercises */}
                      {blockExercises.length > 0 && (
                        <div className="space-y-2">
                          {blockExercises.map((exercise, exerciseIdx) => {
                            const exerciseType = exercise.type || '';

                            return (
                              <div
                                key={exercise.id || `exercise-${blockIdx}-${exerciseIdx}`}
                                className="flex items-start justify-between p-3 bg-background border rounded-md"
                              >
                                <div className="flex-1">
                                  <h4 className="font-medium">{exercise.name}</h4>
                                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                                    {exercise.sets && (
                                      <Badge variant="outline">{exercise.sets} sets</Badge>
                                    )}
                                    {exercise.reps && (
                                      <Badge variant="outline">{exercise.reps} reps</Badge>
                                    )}
                                    {exercise.reps_range && (
                                      <Badge variant="outline">{exercise.reps_range} reps</Badge>
                                    )}
                                    {exercise.duration_sec && (
                                      <Badge variant="outline">{exercise.duration_sec}s</Badge>
                                    )}
                                    {exercise.distance_m && (
                                      <Badge variant="outline">{exercise.distance_m}m</Badge>
                                    )}
                                    {exercise.distance_range && (
                                      <Badge variant="outline">{exercise.distance_range}</Badge>
                                    )}
                                    {exercise.rest_sec && (
                                      <Badge variant="outline">{exercise.rest_sec}s rest</Badge>
                                    )}
                                    {exerciseType && (
                                      <Badge variant="secondary">{exerciseType}</Badge>
                                    )}
                                  </div>
                                  {exercise.notes && (
                                    <p className="text-xs text-muted-foreground mt-2 italic">{exercise.notes}</p>
                                  )}
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
                              <div key={superset.id || supersetIdx} className="border-l-4 border-primary pl-3">
                                {/* Superset header */}
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="default" className="text-xs">
                                    Superset {supersetIdx + 1}
                                  </Badge>
                                  {superset.rest_between_sec && (
                                    <span className="text-xs text-muted-foreground">
                                      {superset.rest_between_sec}s rest between exercises
                                    </span>
                                  )}
                                </div>

                                {/* Superset exercises */}
                                <div className="space-y-2">
                                  {supersetExercises.map((exercise, exerciseIdx) => {
                                    const exerciseType = exercise.type || '';

                                    return (
                                      <div
                                        key={exercise.id || `superset-${blockIdx}-${supersetIdx}-exercise-${exerciseIdx}`}
                                        className="flex items-start justify-between p-3 bg-background border rounded-md"
                                      >
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono text-muted-foreground">
                                              {String.fromCharCode(65 + exerciseIdx)}
                                            </span>
                                            <h4 className="font-medium">{exercise.name}</h4>
                                          </div>
                                          <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground ml-5">
                                            {exercise.sets && (
                                              <Badge variant="outline">{exercise.sets} sets</Badge>
                                            )}
                                            {exercise.reps && (
                                              <Badge variant="outline">{exercise.reps} reps</Badge>
                                            )}
                                            {exercise.reps_range && (
                                              <Badge variant="outline">{exercise.reps_range} reps</Badge>
                                            )}
                                            {exercise.duration_sec && (
                                              <Badge variant="outline">{exercise.duration_sec}s</Badge>
                                            )}
                                            {exercise.distance_m && (
                                              <Badge variant="outline">{exercise.distance_m}m</Badge>
                                            )}
                                            {exercise.distance_range && (
                                              <Badge variant="outline">{exercise.distance_range}</Badge>
                                            )}
                                            {exercise.rest_sec && (
                                              <Badge variant="outline">{exercise.rest_sec}s rest</Badge>
                                            )}
                                            {exerciseType && (
                                              <Badge variant="secondary">{exerciseType}</Badge>
                                            )}
                                          </div>
                                          {exercise.notes && (
                                            <p className="text-xs text-muted-foreground mt-2 italic ml-5">{exercise.notes}</p>
                                          )}
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
                      {blockExercises.length === 0 && blockSupersets.length === 0 && (
                        <div className="text-center text-sm text-muted-foreground py-4">
                          No exercises in this block
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
