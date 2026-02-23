import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Info } from 'lucide-react';
import { Block, RestType, WorkoutSettings } from '../types/workout';

// Updates that can be applied from EditBlockDialog
export interface BlockUpdates {
  label?: string;
  // Rest override (AMA-96)
  restOverrideEnabled?: boolean;
  restType?: RestType;
  restSec?: number | null;
  // Sets/Reps bulk editing
  sets?: number | null;
  applyReps?: boolean;
  reps?: number | null;
  applyRepsRange?: boolean;
  repsRange?: string | null;
}

interface EditBlockDialogProps {
  open: boolean;
  block: Block | null;
  workoutSettings?: WorkoutSettings;
  onSave: (updates: BlockUpdates) => void;
  onClose: () => void;
}

// Format duration in seconds to human-readable format
const formatDuration = (seconds: number): string => {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSec = seconds % 60;
    return remainingSec > 0 ? `${minutes}m ${remainingSec}s` : `${minutes}m`;
  }
  return `${seconds}s`;
};


export function EditBlockDialog({ open, block, workoutSettings, onSave, onClose }: EditBlockDialogProps) {
  // Block name
  const [label, setLabel] = useState('');

  // Rest override (AMA-96)
  const [restOverrideEnabled, setRestOverrideEnabled] = useState(false);
  const [restType, setRestType] = useState<RestType>('timed');
  const [restSec, setRestSec] = useState(0);

  // Sets (always applies on save)
  const [sets, setSets] = useState<number | null>(null);

  // Reps (optional override)
  const [applyReps, setApplyReps] = useState(false);
  const [reps, setReps] = useState<number | null>(null);

  // Rep Range (optional override)
  const [applyRepsRange, setApplyRepsRange] = useState(false);
  const [repsRange, setRepsRange] = useState('');


  // Get all exercises in block (including supersets)
  const getAllExercises = () => {
    if (!block) return [];
    const blockExercises = block.exercises?.filter(e => e != null) || [];
    const supersetExercises = (block.supersets || []).flatMap(ss => ss.exercises || []);
    return [...blockExercises, ...supersetExercises];
  };

  // Initialize state when block changes
  useEffect(() => {
    if (block) {
      setLabel(block.label || '');

      // Rest override (AMA-96)
      // Check if block has rest override enabled
      const hasRestOverride = block.restOverride?.enabled ?? false;
      setRestOverrideEnabled(hasRestOverride);

      // Initialize rest type/sec from block override if enabled, otherwise from exercises
      if (hasRestOverride && block.restOverride) {
        setRestType(block.restOverride.restType || 'timed');
        setRestSec(block.restOverride.restSec ?? 0);
      } else {
        // Fallback to first exercise settings for display when override is enabled
        const firstBlockExercise = block.exercises?.[0];
        const firstSupersetExercise = block.supersets?.[0]?.exercises?.[0];
        const firstExercise = firstBlockExercise || firstSupersetExercise;
        setRestType(firstExercise?.rest_type || block.rest_type || 'timed');
        setRestSec(firstExercise?.rest_sec ?? 30);
      }

      // Get common sets value (if all exercises have same sets)
      const allExercises = getAllExercises();
      const setsValues = allExercises.map(ex => ex.sets).filter(s => s != null);
      const commonSets = setsValues.length > 0 && setsValues.every(s => s === setsValues[0])
        ? setsValues[0]
        : null;
      setSets(commonSets);

      // Reset optional override toggles
      setApplyReps(false);
      setApplyRepsRange(false);

      // Get common reps value for display (not applied by default)
      const repsValues = allExercises.map(ex => ex.reps).filter(r => r != null);
      const commonReps = repsValues.length > 0 && repsValues.every(r => r === repsValues[0])
        ? repsValues[0]
        : null;
      setReps(commonReps ?? 10);

      // Get common reps range (not applied by default)
      const rangeValues = allExercises.map(ex => ex.reps_range).filter(r => r != null && r !== '');
      const commonRange = rangeValues.length > 0 && rangeValues.every(r => r === rangeValues[0])
        ? rangeValues[0]
        : null;
      setRepsRange(commonRange ?? '');

    }
  }, [block]);

  const handleSave = () => {
    onSave({
      label,
      // Rest override (AMA-96)
      restOverrideEnabled,
      restType: restOverrideEnabled ? restType : undefined,
      restSec: restOverrideEnabled ? (restType === 'button' ? null : restSec) : undefined,
      // Sets always applies (common bulk operation)
      sets,
      // Reps only applies if toggle is on
      applyReps,
      reps: applyReps ? reps : null,
      // Rep Range only applies if toggle is on
      applyRepsRange,
      repsRange: applyRepsRange ? repsRange : null,
    });
    onClose();
  };

  if (!block) return null;

  // Count all exercises including those in supersets
  const allExercises = getAllExercises();
  const exerciseCount = allExercises.length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Block</DialogTitle>
          <DialogDescription>
            Configure settings for all {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''} in this block
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Block Name */}
          <div className="space-y-2">
            <Label>Block Name</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Block name"
            />
          </div>

          {/* Sets/Reps Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Label className="text-base font-medium">Bulk Edit Sets & Reps</Label>
            </div>

            {/* Sets (always applies) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Sets</Label>
                <span className="text-xs text-muted-foreground">Always applies to all exercises</span>
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={[sets ?? 3]}
                  onValueChange={(values) => setSets(values[0])}
                  min={1}
                  max={10}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={sets ?? ''}
                  onChange={(e) => setSets(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-16 h-8 text-center"
                  min={1}
                  max={20}
                  placeholder="--"
                />
              </div>
            </div>

            {/* Reps (optional override) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={applyReps}
                    onCheckedChange={setApplyReps}
                    id="apply-reps"
                  />
                  <Label htmlFor="apply-reps" className="text-sm cursor-pointer">
                    Override Reps
                  </Label>
                </div>
                {!applyReps && (
                  <span className="text-xs text-muted-foreground">Individual values kept</span>
                )}
              </div>
              {applyReps && (
                <div className="flex items-center gap-2">
                  <Slider
                    value={[reps ?? 10]}
                    onValueChange={(values) => setReps(values[0])}
                    min={1}
                    max={30}
                    step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={reps ?? ''}
                    onChange={(e) => setReps(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-16 h-8 text-center"
                    min={1}
                    max={100}
                    placeholder="--"
                  />
                </div>
              )}
            </div>

            {/* Rep Range (optional override) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={applyRepsRange}
                    onCheckedChange={setApplyRepsRange}
                    id="apply-reps-range"
                  />
                  <Label htmlFor="apply-reps-range" className="text-sm cursor-pointer">
                    Override Rep Range
                  </Label>
                </div>
                {!applyRepsRange && (
                  <span className="text-xs text-muted-foreground">Individual values kept</span>
                )}
              </div>
              {applyRepsRange && (
                <Input
                  value={repsRange}
                  onChange={(e) => setRepsRange(e.target.value)}
                  placeholder="e.g. 8-12"
                  className="w-full"
                />
              )}
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" />
              Toggle overrides to apply values to all exercises
            </p>
          </div>

          {/* Rest Override (AMA-96) */}
          <div className="border rounded-lg overflow-hidden">
            <div className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <Switch
                  checked={restOverrideEnabled}
                  onCheckedChange={setRestOverrideEnabled}
                />
                <span className="text-sm font-medium">Override Rest Settings</span>
              </div>
            </div>

            {!restOverrideEnabled ? (
              <div className="p-3 pt-0 border-t">
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  Using workout default: {workoutSettings?.defaultRestType === 'button'
                    ? 'Lap Button'
                    : workoutSettings?.defaultRestSec
                      ? `Timed ${formatDuration(workoutSettings.defaultRestSec)}`
                      : 'Lap Button'}
                </p>
              </div>
            ) : (
              <div className="p-3 pt-0 space-y-3 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Rest After Exercise</Label>
                  <Select
                    value={restType}
                    onValueChange={(value: RestType) => setRestType(value)}
                  >
                    <SelectTrigger className="w-36 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="timed">Timed</SelectItem>
                      <SelectItem value="button">Lap Button</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {restType === 'timed' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Duration</span>
                      <span className="text-sm font-medium">{formatDuration(restSec)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground w-8">0s</span>
                      <Slider
                        value={[restSec]}
                        onValueChange={(values) => setRestSec(values[0])}
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
                          setRestSec(Math.max(0, Math.min(600, val)));
                        }}
                        className="w-20 h-9 text-center"
                        min={0}
                        max={600}
                        placeholder="sec"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                    Press lap button when ready to continue to next exercise
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              Save Changes
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
