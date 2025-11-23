import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { X, Clock, Watch, Bike, Dumbbell } from 'lucide-react';
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

// Helper function to get structure display name
function getStructureDisplayName(structure: string | null | undefined): string {
  if (!structure) return 'Straight Sets';
  const structureMap: Record<string, string> = {
    'superset': 'Superset',
    'circuit': 'Circuit',
    'tabata': 'Tabata',
    'emom': 'EMOM',
    'amrap': 'AMRAP',
    'for-time': 'For Time',
    'rounds': 'Rounds',
    'sets': 'Sets',
    'regular': 'Regular',
  };
  return structureMap[structure] || structure;
}

export function ViewWorkout({ workout, onClose }: Props) {
  const workoutData = workout.workout;
  const blocks = workoutData?.blocks || [];
  const hasExports = !!(workout.exports);
  const deviceInfo = getDeviceById(workout.device as DeviceId);

  // Calculate total exercise count across all blocks
  const totalExercises = blocks.reduce((sum, block) => {
    const blockExercises = block.exercises?.length || 0;
    const supersetExercises = block.supersets?.reduce(
      (ssSum, ss) => ssSum + (ss.exercises?.length || 0),
      0
    ) || 0;
    return sum + blockExercises + supersetExercises;
  }, 0);

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-4xl h-[85vh] flex flex-col"
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
              <p>No workout blocks defined</p>
            </div>
          ) : (
            <div className="space-y-6">
              {blocks.map((block: Block, blockIdx: number) => {
                const blockExercises = block.exercises || [];
                const supersets = block.supersets || [];
                const blockExerciseCount =
                  blockExercises.length +
                  supersets.reduce((sum, ss) => sum + (ss.exercises?.length || 0), 0);

                return (
                  <div key={block.id || blockIdx} className="border rounded-lg overflow-hidden">
                    {/* Block Header */}
                    <div className="bg-muted px-4 py-3 border-b">
                      <h3 className="font-semibold text-base mb-1">{block.label || `Block ${blockIdx + 1}`}</h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {block.structure && (
                          <span>{getStructureDisplayName(block.structure)}</span>
                        )}
                        {blockExerciseCount > 0 && (
                          <span>{blockExerciseCount} exercise{blockExerciseCount !== 1 ? 's' : ''}</span>
                        )}
                        {block.default_sets && (
                          <span>{block.default_sets} sets</span>
                        )}
                        {(block.rest_between_sec || block.rest_between_rounds_sec) && (
                          <span>
                            {(block.rest_between_sec || block.rest_between_rounds_sec)}s rest
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Block Content */}
                    <div className="p-4 space-y-4">
                      {/* Block-Level Exercises */}
                      {blockExercises.length > 0 && (
                        <div className="space-y-2">
                          {blockExercises.map((exercise: Exercise, exIdx: number) => (
                            <div
                              key={exercise.id || exIdx}
                              className="p-3 bg-background border rounded-md"
                            >
                              <div className="font-medium text-sm mb-2">{exercise.name}</div>
                              <div className="flex flex-wrap gap-2">
                                {exercise.sets && (
                                  <Badge variant="outline" className="text-xs">
                                    {exercise.sets} sets
                                  </Badge>
                                )}
                                {exercise.reps && (
                                  <Badge variant="outline" className="text-xs">
                                    {exercise.reps} reps
                                  </Badge>
                                )}
                                {exercise.reps_range && (
                                  <Badge variant="outline" className="text-xs">
                                    {exercise.reps_range} reps
                                  </Badge>
                                )}
                                {exercise.duration_sec && (
                                  <Badge variant="outline" className="text-xs">
                                    {exercise.duration_sec}s
                                  </Badge>
                                )}
                                {exercise.distance_m && (
                                  <Badge variant="outline" className="text-xs">
                                    {exercise.distance_m}m
                                  </Badge>
                                )}
                                {exercise.distance_range && (
                                  <Badge variant="outline" className="text-xs">
                                    {exercise.distance_range}
                                  </Badge>
                                )}
                                {exercise.rest_sec && (
                                  <Badge variant="outline" className="text-xs">
                                    {exercise.rest_sec}s rest
                                  </Badge>
                                )}
                                {exercise.type && (
                                  <Badge variant="secondary" className="text-xs">
                                    {exercise.type}
                                  </Badge>
                                )}
                              </div>
                              {exercise.notes && (
                                <p className="text-xs italic text-muted-foreground mt-2">{exercise.notes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Supersets */}
                      {supersets.length > 0 && (
                        <div className="space-y-4">
                          {supersets.map((superset, ssIdx) => (
                            <div
                              key={ssIdx}
                              className="border-l-4 border-primary pl-3"
                            >
                              <div className="mb-2">
                                <Badge variant="outline" className="text-xs">
                                  Superset {ssIdx + 1}
                                </Badge>
                                {superset.rest_between_sec && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {superset.rest_between_sec}s rest
                                  </span>
                                )}
                              </div>
                              <div className="space-y-2 ml-5">
                                {(superset.exercises || []).map((exercise: Exercise, exIdx: number) => {
                                  const letter = String.fromCharCode(65 + exIdx); // A, B, C, etc.
                                  return (
                                    <div
                                      key={exercise.id || exIdx}
                                      className="p-3 bg-background border rounded-md"
                                    >
                                      <div className="font-medium text-sm mb-2">
                                        {letter}. {exercise.name}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {exercise.sets && (
                                          <Badge variant="outline" className="text-xs">
                                            {exercise.sets} sets
                                          </Badge>
                                        )}
                                        {exercise.reps && (
                                          <Badge variant="outline" className="text-xs">
                                            {exercise.reps} reps
                                          </Badge>
                                        )}
                                        {exercise.reps_range && (
                                          <Badge variant="outline" className="text-xs">
                                            {exercise.reps_range} reps
                                          </Badge>
                                        )}
                                        {exercise.duration_sec && (
                                          <Badge variant="outline" className="text-xs">
                                            {exercise.duration_sec}s
                                          </Badge>
                                        )}
                                        {exercise.distance_m && (
                                          <Badge variant="outline" className="text-xs">
                                            {exercise.distance_m}m
                                          </Badge>
                                        )}
                                        {exercise.distance_range && (
                                          <Badge variant="outline" className="text-xs">
                                            {exercise.distance_range}
                                          </Badge>
                                        )}
                                        {exercise.rest_sec && (
                                          <Badge variant="outline" className="text-xs">
                                            {exercise.rest_sec}s rest
                                          </Badge>
                                        )}
                                        {exercise.type && (
                                          <Badge variant="secondary" className="text-xs">
                                            {exercise.type}
                                          </Badge>
                                        )}
                                      </div>
                                      {exercise.notes && (
                                        <p className="text-xs italic text-muted-foreground mt-2">{exercise.notes}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Empty State for Block */}
                      {blockExercises.length === 0 && supersets.length === 0 && (
                        <div className="text-center text-muted-foreground text-sm py-4">
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
      </Card>
    </div>
  );
}

