import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Play, Clock, List, CheckCircle2, ExternalLink, Plus, Loader2, CalendarIcon, Smartphone, Trash2 } from 'lucide-react';
// Using native Date formatting
import { listFollowAlong, getFollowAlong, pushToGarmin, pushToAppleWatch, pushToIOSCompanion, deleteFollowAlong } from '../lib/follow-along-api';
import type { FollowAlongWorkout } from '../types/follow-along';
import { toast } from 'sonner';
import { useClerkUser } from '../lib/clerk-auth';
import { FollowAlongInstructions } from './FollowAlongInstructions';
import { VideoIngestDialog } from './VideoIngestDialog';

// Helper to ensure URLs have a protocol
function ensureProtocol(url: string | undefined): string {
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

export function FollowAlongWorkouts() {
  const { user: clerkUser } = useClerkUser();
  const [workouts, setWorkouts] = useState<FollowAlongWorkout[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<FollowAlongWorkout | null>(null);
  const [showIngestDialog, setShowIngestDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showGarminDatePicker, setShowGarminDatePicker] = useState(false);
  const [garminSyncDate, setGarminSyncDate] = useState<Date | undefined>(new Date());
  const [workoutToSync, setWorkoutToSync] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const getUserId = (): string => {
    if (!clerkUser?.id) {
      throw new Error('User not authenticated');
    }
    return clerkUser.id;
  };

  useEffect(() => {
    if (clerkUser?.id) {
      loadWorkouts();
    }
  }, [clerkUser?.id]);

  const loadWorkouts = async () => {
    if (!clerkUser?.id) {
      toast.error('Please sign in to view workouts');
      return;
    }

    setLoading(true);
    try {
      const result = await listFollowAlong(clerkUser.id);
      setWorkouts(result.items);
    } catch (error: any) {
      toast.error(`Failed to load workouts: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkoutCreated = (workout: FollowAlongWorkout) => {
    setWorkouts([workout, ...workouts]);
    setShowIngestDialog(false);
  };

  const handleViewDetails = async (workout: FollowAlongWorkout) => {
    if (!clerkUser?.id) {
      toast.error('Please sign in to view workout details');
      return;
    }

    try {
      const result = await getFollowAlong(workout.id, clerkUser.id);
      setSelectedWorkout(result.followAlongWorkout);
      setShowDetailDialog(true);
    } catch (error: any) {
      toast.error(`Failed to load workout details: ${error.message}`);
    }
  };

  const handlePushToGarmin = async (workoutId: string, scheduleDate?: string) => {
    if (isSyncing) return;
    if (!clerkUser?.id) {
      toast.error('Please sign in to sync workouts');
      return;
    }

    setIsSyncing(true);
    try {
      // Use current date/time if no date provided
      const dateToUse = scheduleDate || new Date().toISOString().split('T')[0];
      const result = await pushToGarmin(workoutId, clerkUser.id, dateToUse);
      if (result?.alreadySynced) {
        toast.info('Already synced to Garmin.');
        loadWorkouts(); // Refresh to update sync status
        setShowGarminDatePicker(false);
        setGarminSyncDate(new Date());
        setWorkoutToSync(null);
      } else if (result.status === 'success') {
        toast.success('Workout synced to Garmin via Unofficial API!');
        loadWorkouts(); // Refresh to update sync status
        setShowGarminDatePicker(false);
        setGarminSyncDate(new Date());
        setWorkoutToSync(null);
      } else {
        toast.error(result.message || 'Failed to sync to Garmin');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to sync to Garmin: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGarminSyncClick = (workoutId: string) => {
    setWorkoutToSync(workoutId);
    setGarminSyncDate(new Date());
    setShowGarminDatePicker(true);
  };

  const handleConfirmGarminSync = () => {
    if (workoutToSync) {
      const dateStr = garminSyncDate ? garminSyncDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      handlePushToGarmin(workoutToSync, dateStr);
    }
  };

  const handlePushToAppleWatch = async (workoutId: string) => {
    if (!clerkUser?.id) {
      toast.error('Please sign in to sync workouts');
      return;
    }

    try {
      const result = await pushToAppleWatch(workoutId, clerkUser.id);
      if (result.status === 'success') {
        toast.success('Workout synced to Apple Watch!');
        loadWorkouts(); // Refresh to update sync status
      } else {
        toast.error(result.message || 'Failed to sync to Apple Watch');
      }
    } catch (error: any) {
      toast.error(`Failed to sync to Apple Watch: ${error.message}`);
    }
  };

  const handlePushToIOSCompanion = async (workoutId: string) => {
    if (!clerkUser?.id) {
      toast.error('Please sign in to sync workouts');
      return;
    }

    try {
      const result = await pushToIOSCompanion(workoutId, clerkUser.id);
      if (result.status === 'success') {
        toast.success('Workout sent to iOS Companion App! Open the app to start your follow-along workout.');
        loadWorkouts(); // Refresh to update sync status
      } else {
        toast.error(result.message || 'Failed to sync to iOS Companion');
      }
    } catch (error: any) {
      toast.error(`Failed to sync to iOS Companion: ${error.message}`);
    }
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!clerkUser?.id) {
      toast.error('Please sign in to delete workouts');
      return;
    }

    if (!confirm('Are you sure you want to delete this workout?')) {
      return;
    }

    try {
      const result = await deleteFollowAlong(workoutId, clerkUser.id);
      if (result.success) {
        toast.success('Workout deleted successfully');
        setShowDetailDialog(false);
        setSelectedWorkout(null);
        loadWorkouts();
      } else {
        toast.error(result.message || 'Failed to delete workout');
      }
    } catch (error: any) {
      toast.error(`Failed to delete workout: ${error.message}`);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Follow-Along Workouts</h2>
          <p className="text-muted-foreground">Extract and sync workout videos from Instagram, YouTube, TikTok & more</p>
        </div>
        <FollowAlongInstructions />
        <Button onClick={() => setShowIngestDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Workout
        </Button>
        {clerkUser?.id && (
          <VideoIngestDialog
            open={showIngestDialog}
            onOpenChange={setShowIngestDialog}
            userId={clerkUser.id}
            onWorkoutCreated={handleWorkoutCreated}
          />
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : workouts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Play className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No follow-along workouts yet</p>
            <p className="text-sm text-muted-foreground mt-2">Add a workout video to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workouts.map((workout) => (
            <Card key={workout.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleViewDetails(workout)}>
              {workout.thumbnailUrl && (
                <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
                  <img
                    src={workout.thumbnailUrl}
                    alt={workout.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <CardTitle className="line-clamp-2">{workout.title}</CardTitle>
                {workout.description && (
                  <CardDescription className="line-clamp-2">{workout.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDuration(workout.videoDurationSec)}
                  </div>
                  <div className="flex items-center gap-1">
                    <List className="h-4 w-4" />
                    {workout.steps.length} steps
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {workout.garminWorkoutId && (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Garmin
                    </Badge>
                  )}
                  {workout.appleWatchWorkoutId && (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Apple Watch
                    </Badge>
                  )}
                  {workout.iosCompanionSyncedAt && (
                    <Badge variant="outline" className="text-xs bg-blue-50">
                      <Smartphone className="h-3 w-3 mr-1" />
                      iOS App
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedWorkout && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedWorkout.title}</DialogTitle>
                {selectedWorkout.description && (
                  <DialogDescription>{selectedWorkout.description}</DialogDescription>
                )}
              </DialogHeader>
              <div className="space-y-4">
                {selectedWorkout.videoProxyUrl && (
                  <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
                    <video
                      src={selectedWorkout.videoProxyUrl}
                      controls
                      className="w-full h-full"
                    />
                  </div>
                )}
                
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Workout Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Duration:</span>
                        <span>{formatDuration(selectedWorkout.videoDurationSec)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Steps:</span>
                        <span>{selectedWorkout.steps.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Source:</span>
                        <a
                          href={ensureProtocol(selectedWorkout.sourceUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 capitalize"
                        >
                          {selectedWorkout.source || 'Video'}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Sync Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        variant={selectedWorkout.garminWorkoutId ? "outline" : "default"}
                        size="sm"
                        className="w-full justify-start"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedWorkout.garminWorkoutId) return;
                          handleGarminSyncClick(selectedWorkout.id);
                        }}
                        disabled={!!selectedWorkout.garminWorkoutId}
                      >
                        {selectedWorkout.garminWorkoutId ? (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4 flex-shrink-0" />
                            <span className="truncate">Synced to Garmin</span>
                          </>
                        ) : (
                          'Sync to Garmin'
                        )}
                      </Button>
                      <Button
                        variant={selectedWorkout.appleWatchWorkoutId ? "outline" : "default"}
                        size="sm"
                        className="w-full justify-start"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePushToAppleWatch(selectedWorkout.id);
                        }}
                        disabled={!!selectedWorkout.appleWatchWorkoutId}
                      >
                        {selectedWorkout.appleWatchWorkoutId ? (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4 flex-shrink-0" />
                            <span className="truncate">Synced to Watch</span>
                          </>
                        ) : (
                          'Send to Apple Watch'
                        )}
                      </Button>
                      <Button
                        variant={selectedWorkout.iosCompanionSyncedAt ? "outline" : "default"}
                        size="sm"
                        className="w-full justify-start"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePushToIOSCompanion(selectedWorkout.id);
                        }}
                      >
                        {selectedWorkout.iosCompanionSyncedAt ? (
                          <>
                            <Smartphone className="mr-2 h-4 w-4 flex-shrink-0" />
                            <span className="truncate">iOS Synced - Resync</span>
                          </>
                        ) : (
                          <>
                            <Smartphone className="mr-2 h-4 w-4 flex-shrink-0" />
                            <span className="truncate">Send to iOS App</span>
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Workout Steps</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedWorkout.steps.map((step) => (
                        <div key={step.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                              {step.order}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{step.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDuration(step.durationSec)}
                                {step.targetReps && ` • ${step.targetReps} reps`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Delete button */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteWorkout(selectedWorkout.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Workout
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Garmin Sync Date Picker Dialog */}
      <Dialog open={showGarminDatePicker} onOpenChange={setShowGarminDatePicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Garmin Sync (Unofficial API)</DialogTitle>
            <DialogDescription>
              Choose a date to sync this workout to Garmin using the unofficial API. Leave as today for immediate sync.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {garminSyncDate ? garminSyncDate ? garminSyncDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Pick a date' : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={garminSyncDate}
                  onSelect={setGarminSyncDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowGarminDatePicker(false);
                  setWorkoutToSync(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmGarminSync}
                className="flex-1"
               disabled={isSyncing}>
                {isSyncing ? "Syncing…" : "Sync to Garmin (Unofficial API)"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

