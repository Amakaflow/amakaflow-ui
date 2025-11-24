import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { X } from 'lucide-react';
import { Exercise } from '../types/workout';

interface EditExerciseDialogProps {
  open: boolean;
  exercise: Exercise | null;
  onSave: (updates: Partial<Exercise>) => void;
  onClose: () => void;
}

type ExerciseType = 'sets-reps' | 'duration' | 'distance';

// Format duration in seconds to human-readable format
const formatDuration = (seconds: number): string => {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSec = seconds % 60;
    return remainingSec > 0 ? `${minutes}m ${remainingSec}s` : `${minutes}m`;
  }
  return `${seconds}s`;
};

// Format distance in meters to human-readable format
const formatDistance = (meters: number): string => {
  if (meters >= 1000) {
    const km = meters / 1000;
    return km % 1 === 0 ? `${km}km` : `${km.toFixed(1)}km`;
  }
  return `${meters}m`;
};

export function EditExerciseDialog({ open, exercise, onSave, onClose }: EditExerciseDialogProps) {
  // Track if dialog should stay open (prevent closing on re-renders)
  const isUserClosingRef = useRef(false);
  const hasOpenedRef = useRef(false);
  const [internalOpen, setInternalOpen] = useState(false);

  // Determine initial exercise type
  const getInitialType = (): ExerciseType => {
    if (!exercise) return 'sets-reps';
    // Check for distance (including 0, but not null/undefined)
    if (exercise.distance_m !== null && exercise.distance_m !== undefined) return 'distance';
    if (exercise.distance_range) return 'distance';
    // Check for duration (including 0, but not null/undefined)
    if (exercise.duration_sec !== null && exercise.duration_sec !== undefined) return 'duration';
    return 'sets-reps';
  };

  // State management
  const [exerciseType, setExerciseType] = useState<ExerciseType>(getInitialType());
  const [name, setName] = useState('');
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [repsRange, setRepsRange] = useState('');
  const [durationSec, setDurationSec] = useState(60);
  const [distanceM, setDistanceM] = useState(1000);
  const [distanceRange, setDistanceRange] = useState('');
  const [restSec, setRestSec] = useState(0);
  const [notes, setNotes] = useState('');

  // Sync internal open state with prop - only open when prop becomes true, never close from prop
  useEffect(() => {
    if (open && !hasOpenedRef.current) {
      // Opening for the first time
      hasOpenedRef.current = true;
      isUserClosingRef.current = false;
      setInternalOpen(true);
    } else if (!open && hasOpenedRef.current && isUserClosingRef.current) {
      // Only close if user explicitly closed AND prop says close
      hasOpenedRef.current = false;
      setInternalOpen(false);
    }
    // If prop says close but user didn't explicitly close, ignore it (prevent re-render close)
  }, [open]);

  // Initialize state when exercise changes
  useEffect(() => {
    if (exercise) {
      setName(exercise.name || '');
      setSets(exercise.sets ?? 3);
      setReps(exercise.reps ?? 10);
      setRepsRange(exercise.reps_range || '');
      setDurationSec(exercise.duration_sec ?? 60);
      // Preserve 0 values for distance_m (don't default to 1000 if it's 0)
      setDistanceM(exercise.distance_m !== null && exercise.distance_m !== undefined ? exercise.distance_m : 1000);
      setDistanceRange(exercise.distance_range || '');
      // Default to 0 if rest_sec is not set (null or undefined)
      setRestSec(exercise.rest_sec !== null && exercise.rest_sec !== undefined ? exercise.rest_sec : 0);
      setNotes(exercise.notes || '');
      setExerciseType(getInitialType());
    }
  }, [exercise]);

  // Update exercise immediately when values change (Figma-style live updates)
  const updateExerciseImmediately = useCallback((overrides?: {
    name?: string;
    sets?: number;
    reps?: number;
    repsRange?: string;
    durationSec?: number;
    distanceM?: number;
    distanceRange?: string;
    restSec?: number;
    notes?: string;
    exerciseType?: ExerciseType;
  }) => {
    if (!exercise) return;

    const currentName = overrides?.name ?? name;
    const currentSets = overrides?.sets ?? sets;
    const currentReps = overrides?.reps ?? reps;
    const currentRepsRange = overrides?.repsRange ?? repsRange;
    const currentDurationSec = overrides?.durationSec ?? durationSec;
    const currentDistanceM = overrides?.distanceM ?? distanceM;
    const currentDistanceRange = overrides?.distanceRange ?? distanceRange;
    const currentRestSec = overrides?.restSec ?? restSec;
    const currentNotes = overrides?.notes ?? notes;
    const currentExerciseType = overrides?.exerciseType ?? exerciseType;

    const updates: Partial<Exercise> = {
      name: currentName,
      rest_sec: currentRestSec,
      notes: currentNotes || null,
    };

    // Clear fields from other types and set relevant fields
    if (currentExerciseType === 'sets-reps') {
      updates.sets = currentSets;
      updates.reps = currentRepsRange ? null : currentReps;
      updates.reps_range = currentRepsRange || null;
      updates.duration_sec = null;
      updates.distance_m = null;
      updates.distance_range = null;
    } else if (currentExerciseType === 'duration') {
      updates.duration_sec = currentDurationSec;
      updates.sets = null;
      updates.reps = null;
      updates.reps_range = null;
      updates.distance_m = null;
      updates.distance_range = null;
    } else if (currentExerciseType === 'distance') {
      // Allow 0 as a valid distance value
      updates.distance_m = currentDistanceRange ? null : (currentDistanceM !== null && currentDistanceM !== undefined ? currentDistanceM : null);
      updates.distance_range = currentDistanceRange || null;
      updates.sets = null;
      updates.reps = null;
      updates.reps_range = null;
      updates.duration_sec = null;
    }

    onSave(updates);
  }, [exercise, exerciseType, name, sets, reps, repsRange, durationSec, distanceM, distanceRange, restSec, notes, onSave]);

  // Handle tab change - clear other fields immediately
  const handleTabChange = (newType: ExerciseType) => {
    setExerciseType(newType);
    updateExerciseImmediately({ exerciseType: newType });
  };

  const handleClose = () => {
    isUserClosingRef.current = true;
    hasOpenedRef.current = false;
    setInternalOpen(false);
    onClose();
  };

  const handleSave = () => {
    updateExerciseImmediately();
    handleClose();
  };

  if (!exercise) return null;

  return (
    <Dialog
      open={internalOpen}
      onOpenChange={(isOpen) => {
        // Only close when user explicitly closes (ESC, click outside)
        if (!isOpen) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Edit Exercise</DialogTitle>
          <DialogDescription>
            Update the exercise details below
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Exercise Name */}
          <div className="space-y-2">
            <Label>Exercise Name</Label>
            <Input
              value={name}
              onChange={(e) => {
                const newValue = e.target.value;
                setName(newValue);
                updateExerciseImmediately({ name: newValue });
              }}
              placeholder="Exercise name"
            />
          </div>

          {/* Exercise Type Tabs */}
          <div className="space-y-3">
            <Label>Exercise Type</Label>
            <Tabs value={exerciseType} onValueChange={(value) => handleTabChange(value as ExerciseType)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="sets-reps">Sets/Reps</TabsTrigger>
                <TabsTrigger value="duration">Duration</TabsTrigger>
                <TabsTrigger value="distance">Distance</TabsTrigger>
              </TabsList>

              {/* Sets/Reps Tab */}
              <TabsContent value="sets-reps" className="space-y-4 mt-4">
                {/* Sets Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Sets</Label>
                    <span className="text-sm font-medium">{sets}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-8">0</span>
                    <Slider
                      value={[sets]}
                      onValueChange={(values) => {
                        const newValue = values[0];
                        setSets(newValue);
                        updateExerciseImmediately({ sets: newValue });
                      }}
                      min={0}
                      max={10}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-8 text-right">10</span>
                    <Input
                      type="number"
                      value={sets}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const clampedVal = Math.max(0, Math.min(10, val));
                        setSets(clampedVal);
                        updateExerciseImmediately({ sets: clampedVal });
                      }}
                      className="w-16 h-9 text-center"
                      min={0}
                      max={10}
                    />
                  </div>
                </div>

                {/* Reps Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Reps</Label>
                    <span className="text-sm font-medium">{reps}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-8">0</span>
                    <Slider
                      value={[reps]}
                      onValueChange={(values) => {
                        const newValue = values[0];
                        setReps(newValue);
                        updateExerciseImmediately({ reps: newValue });
                      }}
                      min={0}
                      max={50}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-8 text-right">50</span>
                    <Input
                      type="number"
                      value={reps}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const clampedVal = Math.max(0, Math.min(50, val));
                        setReps(clampedVal);
                        updateExerciseImmediately({ reps: clampedVal });
                      }}
                      className="w-16 h-9 text-center"
                      min={0}
                      max={50}
                    />
                  </div>
                </div>

                {/* Reps Range (Optional) */}
                <div className="space-y-2">
                  <Label>Reps Range (optional)</Label>
                  <Input
                    value={repsRange}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setRepsRange(newValue);
                      updateExerciseImmediately({ repsRange: newValue });
                    }}
                    placeholder="e.g., 10-12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use this instead of Reps for ranges like "8-10"
                  </p>
                </div>
              </TabsContent>

              {/* Duration Tab */}
              <TabsContent value="duration" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Duration (seconds)</Label>
                    <span className="text-sm font-medium">{formatDuration(durationSec)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-8">0s</span>
                    <Slider
                      value={[durationSec]}
                      onValueChange={(values) => {
                        const newValue = values[0];
                        setDurationSec(newValue);
                        updateExerciseImmediately({ durationSec: newValue });
                      }}
                      min={0}
                      max={600}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-8 text-right">10m</span>
                    <Input
                      type="number"
                      value={durationSec}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const clampedVal = Math.max(0, Math.min(3600, val));
                        setDurationSec(clampedVal);
                        updateExerciseImmediately({ durationSec: clampedVal });
                      }}
                      className="w-20 h-9 text-center"
                      min={0}
                      max={3600}
                      placeholder="sec"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    e.g., 60 for 1 minute, 300 for 5 minutes
                  </p>
                </div>
              </TabsContent>

              {/* Distance Tab */}
              <TabsContent value="distance" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Distance</Label>
                    <span className="text-sm font-medium">{formatDistance(distanceM)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-8">0m</span>
                    <Slider
                      value={[distanceM]}
                      onValueChange={(values) => {
                        const newValue = values[0];
                        setDistanceM(newValue);
                        updateExerciseImmediately({ distanceM: newValue });
                      }}
                      min={0}
                      max={5000}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-8 text-right">5km</span>
                    <Input
                      type="number"
                      value={distanceM}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const clampedVal = Math.max(0, Math.min(10000, val));
                        setDistanceM(clampedVal);
                        updateExerciseImmediately({ distanceM: clampedVal });
                      }}
                      className="w-20 h-9 text-center"
                      min={0}
                      max={10000}
                      placeholder="m"
                    />
                  </div>
                </div>

                {/* Distance Range (Optional) */}
                <div className="space-y-2">
                  <Label>Distance Range (optional)</Label>
                  <Input
                    value={distanceRange}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setDistanceRange(newValue);
                      updateExerciseImmediately({ distanceRange: newValue });
                    }}
                    placeholder="e.g., 100-200m"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use this instead of Distance for ranges
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Rest (Universal) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Rest (seconds)</Label>
              <span className="text-sm font-medium">{formatDuration(restSec)}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground w-8">0s</span>
              <Slider
                value={[restSec]}
                onValueChange={(values) => {
                  const newValue = values[0];
                  setRestSec(newValue);
                  updateExerciseImmediately({ restSec: newValue });
                }}
                min={0}
                max={300}
                step={5}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-8 text-right">5m</span>
              <Input
                type="number"
                value={restSec}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  const clampedVal = Math.max(0, Math.min(600, val));
                  setRestSec(clampedVal);
                  updateExerciseImmediately({ restSec: clampedVal });
                }}
                className="w-20 h-9 text-center"
                min={0}
                max={600}
                placeholder="sec"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => {
                const newValue = e.target.value;
                setNotes(newValue);
                updateExerciseImmediately({ notes: newValue });
              }}
              placeholder="Optional notes"
              rows={3}
            />
          </div>

          {/* Done Button */}
          <Button onClick={handleSave} className="w-full">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
