import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Clock, Dumbbell, Watch, Bike, Download, Activity, CheckCircle2, ExternalLink, Eye, Trash2, ChevronRight, Edit, List } from 'lucide-react';
import { WorkoutHistoryItem } from '../lib/workout-history';
import { isAccountConnectedSync } from '../lib/linked-accounts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

type Props = {
  history: WorkoutHistoryItem[];
  onLoadWorkout: (item: WorkoutHistoryItem) => void;
  onEditWorkout?: (item: WorkoutHistoryItem) => void;
  onDeleteWorkout: (id: string) => void;
  onEnhanceStrava?: (item: WorkoutHistoryItem) => void;
};

export function WorkoutHistory({ history, onLoadWorkout, onEditWorkout, onDeleteWorkout, onEnhanceStrava }: Props) {
  const stravaConnected = isAccountConnectedSync('strava');
  const [viewingWorkout, setViewingWorkout] = useState<WorkoutHistoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');
  
  // Ensure history is an array
  const safeHistory = Array.isArray(history) ? history : [];
  
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this workout?')) {
      setDeletingId(id);
      try {
        await onDeleteWorkout(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Helper to get mapped exercise name from validation
  const getMappedExerciseName = (originalName: string, validation: any): string => {
    if (!validation) return originalName;
    
    // Check all validation arrays for a mapping
    const allValidated = [
      ...(validation.validated_exercises || []),
      ...(validation.needs_review || []),
      ...(validation.unmapped_exercises || [])
    ];
    
    const match = allValidated.find((v: any) => 
      v.original_name === originalName && v.mapped_to
    );
    
    return match?.mapped_to || originalName;
  };

  // Helper to download export file
  const handleExport = (item: WorkoutHistoryItem) => {
    if (!item.exports) return;
    
    const format = item.device === 'garmin' ? item.exports?.fit 
      : item.device === 'apple' ? item.exports?.plist 
      : item.exports?.zwo;
    
    if (format) {
      const blob = new Blob([format], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(item.workout.title || 'workout').replace(/\s+/g, '_')}.${
        item.device === 'garmin' ? 'fit' : item.device === 'apple' ? 'plist' : 'zwo'
      }`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'garmin':
      case 'apple':
        return <Watch className="w-4 h-4" />;
      case 'zwift':
        return <Bike className="w-4 h-4" />;
      default:
        return <Dumbbell className="w-4 h-4" />;
    }
  };

  if (safeHistory.length === 0) {
    return (
      <div className="text-center py-16">
        <Dumbbell className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
        <h3 className="text-xl mb-2">No workout history yet</h3>
        <p className="text-muted-foreground mb-6">
          Create your first workout to see it here
        </p>
        <Button onClick={() => window.location.reload()}>
          Create Workout
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-1">Workout History</h2>
          <p className="text-sm text-muted-foreground">
            {safeHistory.length} workout{safeHistory.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
            className="gap-2"
          >
            <List className="w-4 h-4" />
            Cards
          </Button>
          <Button
            variant={viewMode === 'compact' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('compact')}
            className="gap-2"
          >
            <List className="w-4 h-4" />
            Compact
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className={viewMode === 'cards' ? 'space-y-2 pr-4' : 'space-y-1 pr-4'}>
          {safeHistory.map((item) => {
            // Safety check: ensure workout exists
            if (!item.workout) {
              console.warn('WorkoutHistory item missing workout data:', item);
              return (
                <Card key={item.id} className="hover:shadow-md transition-shadow border-orange-500/50">
                  <CardHeader>
                    <CardTitle className="text-lg text-orange-600">Invalid Workout Data</CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">This workout has missing data and cannot be displayed.</p>
                  </CardHeader>
                </Card>
              );
            }

            const exerciseCount = (item.workout.blocks || []).reduce(
              (sum, block) => {
                // Handle both old format (exercises directly on block) and new format (exercises in supersets)
                if (block?.supersets && block.supersets.length > 0) {
                  return sum + block.supersets.reduce((s, ss) => s + (ss?.exercises?.length || 0), 0);
                } else if (block?.exercises) {
                  return sum + (block.exercises.length || 0);
                }
                return sum;
              },
              0
            );

            // Compact view
            if (viewMode === 'compact') {
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold truncate">{item.workout?.title || 'Untitled Workout'}</h3>
                      {(item as any).isExported ? (
                        <Badge variant="default" className="bg-green-600 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Exported
                        </Badge>
                      ) : item.exports ? (
                        <Badge variant="secondary" className="text-xs">Ready</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Draft</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(item.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        {getDeviceIcon(item.device)}
                        <span className="capitalize">{item.device}</span>
                      </span>
                      <span>{item.workout.blocks?.length || 0} blocks</span>
                      <span>{exerciseCount} exercises</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setViewingWorkout(item)}
                      className="h-8 w-8 p-0"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {onEditWorkout && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditWorkout(item)}
                        className="h-8 w-8 p-0"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onLoadWorkout(item)}
                      className="h-8 w-8 p-0"
                      title="Load"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    {item.exports && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleExport(item)}
                        className="h-8 w-8 p-0"
                        title="Export"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            }

            // Card view - improved readability
            return (
              <Card key={item.id} className="hover:shadow-md transition-all border-border/50 bg-card">
                <CardHeader className="pb-3 px-4 pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <CardTitle className="text-lg font-bold truncate text-foreground">
                        {item.workout?.title || 'Untitled Workout'}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span className="font-medium">{formatDate(item.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          {getDeviceIcon(item.device)}
                          <span className="font-medium capitalize">{item.device}</span>
                        </div>
                        <div className="text-muted-foreground">
                          <span className="font-medium">{item.workout.blocks?.length || 0}</span> blocks
                        </div>
                        <div className="text-muted-foreground">
                          <span className="font-medium">{exerciseCount}</span> exercises
                        </div>
                        {item.syncedToStrava && (
                          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            Strava
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {(item as any).isExported ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                          <CheckCircle2 className="w-3 h-3 mr-1.5" />
                          Exported
                        </Badge>
                      ) : item.exports ? (
                        <Badge variant="secondary" className="font-medium">Ready to Export</Badge>
                      ) : (
                        <Badge variant="outline" className="font-medium">Draft</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 border-t bg-muted/20">
                  <div className="flex items-center justify-between gap-3 pt-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingWorkout(item)}
                        className="gap-2 h-9 font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                      {onEditWorkout && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEditWorkout(item)}
                          className="gap-2 h-9 font-medium"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => onLoadWorkout(item)}
                        className="gap-2 h-9 font-medium"
                      >
                        Load
                      </Button>
                      {item.exports && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExport(item)}
                          className="gap-2 h-9 font-medium"
                        >
                          <Download className="w-4 h-4" />
                          Export
                        </Button>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="h-9 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deletingId === item.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* View Workout Dialog */}
      <Dialog open={!!viewingWorkout} onOpenChange={(open) => !open && setViewingWorkout(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingWorkout?.workout?.title || 'Untitled Workout'}</DialogTitle>
            <DialogDescription>
              Workout details and structure
            </DialogDescription>
          </DialogHeader>
          {viewingWorkout && (
            <div className="space-y-6 py-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Device</div>
                  <div className="font-medium capitalize">{viewingWorkout.device}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Blocks</div>
                  <div className="font-medium">{viewingWorkout.workout?.blocks?.length || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Exercises</div>
                  <div className="font-medium">
                    {(viewingWorkout.workout?.blocks || []).reduce((sum: number, block: any) => {
                      if (block?.supersets && block.supersets.length > 0) {
                        return sum + block.supersets.reduce((s: number, ss: any) => s + (ss?.exercises?.length || 0), 0);
                      } else if (block?.exercises) {
                        return sum + (block.exercises.length || 0);
                      }
                      return sum;
                    }, 0)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Created</div>
                  <div className="font-medium text-sm">{formatDate(viewingWorkout.createdAt)}</div>
                </div>
              </div>

              {/* Blocks */}
              {viewingWorkout.workout?.blocks && viewingWorkout.workout.blocks.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Workout Blocks</h3>
                    {viewingWorkout.validation && (
                      <Badge variant="secondary" className="text-xs">
                        Post-Validation (Mapped)
                      </Badge>
                    )}
                  </div>
                  {viewingWorkout.workout.blocks.map((block: any, blockIdx: number) => (
                    <Card key={blockIdx} className="border-border/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          Block {blockIdx + 1}: {block.title || block.name || block.label || 'Untitled Block'}
                        </CardTitle>
                        {block.structure && (
                          <p className="text-sm text-muted-foreground mt-1">{block.structure}</p>
                        )}
                      </CardHeader>
                      <CardContent className="pt-0">
                        {block.supersets && block.supersets.length > 0 ? (
                          <div className="space-y-3">
                            {block.supersets.map((superset: any, ssIdx: number) => (
                              <div key={ssIdx} className="p-4 bg-muted/30 rounded-lg border border-border/50">
                                <div className="text-sm font-semibold mb-3 text-foreground">Superset {ssIdx + 1}</div>
                                {superset.exercises && superset.exercises.length > 0 && (
                                  <ul className="space-y-0.5">
                                    {superset.exercises.map((exercise: any, exIdx: number) => {
                                      const originalName = exercise.name || exercise.exercise || 'Unknown Exercise';
                                      const mappedName = getMappedExerciseName(originalName, viewingWorkout.validation);
                                      const isMapped = mappedName !== originalName;
                                      return (
                                        <li key={exIdx} className="flex items-start gap-2.5 py-1">
                                          <span className="text-muted-foreground mt-0.5">•</span>
                                          <div className="flex-1 space-y-1">
                                            <div className="flex items-baseline gap-2 flex-wrap">
                                              <span className="font-semibold text-base">{mappedName}</span>
                                              {isMapped && (
                                                <span className="text-[10px] text-muted-foreground/70 italic font-normal">
                                                  was: {originalName}
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                                              {exercise.sets && <span>({exercise.sets} sets)</span>}
                                              {exercise.reps && <span>{exercise.reps} reps</span>}
                                              {exercise.reps_range && <span>{exercise.reps_range}</span>}
                                              {exercise.weight && <span>{exercise.weight}</span>}
                                              {exercise.duration_sec && <span>{Math.round(exercise.duration_sec / 60)} min</span>}
                                              {exercise.distance_m && <span>{exercise.distance_m}m</span>}
                                              {exercise.rest_sec && <span>Rest: {exercise.rest_sec}s</span>}
                                            </div>
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : block.exercises && block.exercises.length > 0 ? (
                          <ul className="space-y-1">
                            {block.exercises.map((exercise: any, exIdx: number) => {
                              const originalName = exercise.name || exercise.exercise || 'Unknown Exercise';
                              const mappedName = getMappedExerciseName(originalName, viewingWorkout.validation);
                              const isMapped = mappedName !== originalName;
                              return (
                                <li key={exIdx} className="flex items-start gap-2.5 py-1">
                                  <span className="text-muted-foreground mt-0.5">•</span>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                      <span className="font-semibold text-base">{mappedName}</span>
                                      {isMapped && (
                                        <span className="text-[10px] text-muted-foreground/70 italic font-normal">
                                          was: {originalName}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                                      {exercise.sets && <span>({exercise.sets} sets)</span>}
                                      {exercise.reps && <span>{exercise.reps} reps</span>}
                                      {exercise.reps_range && <span>{exercise.reps_range}</span>}
                                      {exercise.weight && <span>{exercise.weight}</span>}
                                      {exercise.duration_sec && <span>{Math.round(exercise.duration_sec / 60)} min</span>}
                                      {exercise.distance_m && <span>{exercise.distance_m}m</span>}
                                      {exercise.rest_sec && <span>Rest: {exercise.rest_sec}s</span>}
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">No exercises in this block</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Sources */}
              {viewingWorkout.sources && viewingWorkout.sources.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Sources</h3>
                  <div className="space-y-2">
                    {viewingWorkout.sources.map((source: string, idx: number) => {
                      const [type, ...content] = source.split(':');
                      return (
                        <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1 uppercase">{type}</div>
                          <div className="text-sm whitespace-pre-wrap">{content.join(':')}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                {viewingWorkout.exports && (
                  <Button
                    onClick={() => handleExport(viewingWorkout)}
                    className="gap-2"
                    variant="default"
                  >
                    <Download className="w-4 h-4" />
                    Export to {viewingWorkout.device === 'garmin' ? 'Garmin' : viewingWorkout.device === 'apple' ? 'Apple Watch' : 'Zwift'}
                  </Button>
                )}
                {onEditWorkout && (
                  <Button
                    onClick={() => {
                      if (viewingWorkout) {
                        onEditWorkout(viewingWorkout);
                        setViewingWorkout(null);
                      }
                    }}
                    variant={viewingWorkout.exports ? "outline" : "default"}
                    className="gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Workout
                  </Button>
                )}
                <Button
                  onClick={() => {
                    if (viewingWorkout) {
                      onLoadWorkout(viewingWorkout);
                      setViewingWorkout(null);
                    }
                  }}
                  variant="outline"
                  className="gap-2"
                >
                  Load Workout
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setViewingWorkout(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}