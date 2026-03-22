import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Info } from 'lucide-react';
import { WorkoutSettings, RestType, WarmupActivity } from '../types/workout';

interface WorkoutSettingsDialogProps {
  open: boolean;
  title: string;
  settings: WorkoutSettings | undefined;
  onSave: (title: string, settings: WorkoutSettings) => void;
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

// Default settings when none exist
const getDefaultSettings = (): WorkoutSettings => ({
  defaultRestType: 'button',
  defaultRestSec: null,
});

// Warm-up activity display names
const WARMUP_ACTIVITIES: { value: WarmupActivity; label: string }[] = [
  { value: 'stretching', label: 'Stretching' },
  { value: 'jump_rope', label: 'Jump Rope' },
  { value: 'air_bike', label: 'Air Bike' },
  { value: 'treadmill', label: 'Treadmill' },
  { value: 'stairmaster', label: 'Stairmaster' },
  { value: 'rowing', label: 'Rowing' },
  { value: 'custom', label: 'Custom' },
];

export function WorkoutSettingsDialog({ open, title, settings, onSave, onClose }: WorkoutSettingsDialogProps) {
  const [workoutTitle, setWorkoutTitle] = useState(title);
  const [defaultRestType, setDefaultRestType] = useState<RestType>('button');
  const [defaultRestSec, setDefaultRestSec] = useState<number>(30);
  const [warmupEnabled, setWarmupEnabled] = useState(false);
  const [warmupActivity, setWarmupActivity] = useState<WarmupActivity>('stretching');
  const [warmupDurationSec, setWarmupDurationSec] = useState(300);
  const [autoAddPeriods, setAutoAddPeriods] = useState(false);

  // Initialize state when dialog opens
  useEffect(() => {
    if (open) {
      setWorkoutTitle(title);
      const currentSettings = settings || getDefaultSettings();
      setDefaultRestType(currentSettings.defaultRestType);
      setDefaultRestSec(currentSettings.defaultRestSec || 30);
      setWarmupEnabled(currentSettings.workoutWarmup?.enabled || false);
      setWarmupActivity(currentSettings.workoutWarmup?.activity || 'stretching');
      setWarmupDurationSec(currentSettings.workoutWarmup?.durationSec || 300);
      setAutoAddPeriods(currentSettings.autoAddPeriods || false);
    }
  }, [open, title, settings]);

  const handleSave = () => {
    const newSettings: WorkoutSettings = {
      defaultRestType,
      defaultRestSec: defaultRestType === 'timed' ? defaultRestSec : null,
      workoutWarmup: warmupEnabled
        ? {
            enabled: true,
            activity: warmupActivity,
            durationSec: warmupDurationSec,
          }
        : undefined,
      autoAddPeriods,
    };
    onSave(workoutTitle, newSettings);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Workout Settings</DialogTitle>
          <DialogDescription>
            Configure workout name and default settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Workout Name */}
          <div className="space-y-2">
            <Label>Workout Name</Label>
            <Input
              value={workoutTitle}
              onChange={(e) => setWorkoutTitle(e.target.value)}
              placeholder="Enter workout name"
            />
          </div>

          {/* Default Rest Settings */}
          <div className="border rounded-lg overflow-hidden">
            <div className="w-full flex items-center justify-between p-3 bg-muted/30">
              <span className="text-sm font-medium">Default Rest After Exercise</span>
              <Select
                value={defaultRestType}
                onValueChange={(value: RestType) => setDefaultRestType(value)}
              >
                <SelectTrigger className="w-36 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="button">Lap Button</SelectItem>
                  <SelectItem value="timed">Timed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {defaultRestType === 'timed' ? (
              <div className="p-3 space-y-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Duration</span>
                  <span className="text-sm font-medium">
                    {formatDuration(defaultRestSec)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-8">0s</span>
                  <Slider
                    value={[defaultRestSec]}
                    onValueChange={(values) => setDefaultRestSec(values[0])}
                    min={0}
                    max={300}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right">5m</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Applied to all exercises unless overridden at block level
                </p>
              </div>
            ) : (
              <div className="p-3 border-t">
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  Press lap button when ready to continue to next exercise
                </p>
              </div>
            )}
          </div>

          {/* Workout Warm-Up */}
          <div className="border rounded-lg overflow-hidden">
            <div className="w-full flex items-center justify-between p-3 bg-muted/30">
              <div className="flex items-center gap-3">
                <Switch
                  checked={warmupEnabled}
                  onCheckedChange={setWarmupEnabled}
                />
                <span className="text-sm font-medium">Workout Warm-Up</span>
              </div>
            </div>

            {warmupEnabled && (
              <div className="p-3 space-y-4 border-t">
                {/* Warm-up Activity */}
                <div className="space-y-2">
                  <Label className="text-sm">Activity</Label>
                  <Select
                    value={warmupActivity}
                    onValueChange={(value: WarmupActivity) => setWarmupActivity(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WARMUP_ACTIVITIES.map((activity) => (
                        <SelectItem key={activity.value} value={activity.value}>
                          {activity.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Warm-up Duration */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Duration</Label>
                    <span className="text-sm font-medium">
                      {formatDuration(warmupDurationSec)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[warmupDurationSec]}
                      onValueChange={(values) => setWarmupDurationSec(values[0])}
                      min={60}
                      max={1200}
                      step={30}
                      className="flex-1"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Added before the first exercise of the workout
                </p>
              </div>
            )}
          </div>

          {/* AMA-205: Auto-add Periods Toggle */}
          <div className="border rounded-lg overflow-hidden">
            <div className="w-full flex items-center justify-between p-3 bg-muted/30">
              <div className="flex items-center gap-3">
                <Switch
                  checked={autoAddPeriods}
                  onCheckedChange={setAutoAddPeriods}
                  data-testid="auto-add-periods-toggle"
                />
                <div>
                  <span className="text-sm font-medium">Auto-add Warm-up & Rest</span>
                  <p className="text-xs text-muted-foreground">
                    Automatically add 5-min warm-up, 60-90s rest, and 5-min cooldown for strength workouts
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <Button onClick={handleSave} className="w-full">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
