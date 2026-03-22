import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { ChevronDown, ChevronUp, Settings2, Info } from 'lucide-react';
import { WorkoutSettings, RestType, WarmupActivity } from '../types/workout';

interface WorkoutSettingsPanelProps {
  settings: WorkoutSettings | undefined;
  onSettingsChange: (settings: WorkoutSettings) => void;
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

export function WorkoutSettingsPanel({ settings, onSettingsChange }: WorkoutSettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Use provided settings or defaults
  const currentSettings = settings || getDefaultSettings();

  const handleRestTypeChange = (value: RestType) => {
    onSettingsChange({
      ...currentSettings,
      defaultRestType: value,
      defaultRestSec: value === 'button' ? null : (currentSettings.defaultRestSec || 30),
    });
  };

  const handleRestSecChange = (value: number) => {
    onSettingsChange({
      ...currentSettings,
      defaultRestSec: value,
    });
  };

  const handleWarmupToggle = (enabled: boolean) => {
    onSettingsChange({
      ...currentSettings,
      workoutWarmup: enabled
        ? {
            enabled: true,
            activity: currentSettings.workoutWarmup?.activity || 'stretching',
            durationSec: currentSettings.workoutWarmup?.durationSec || 300,
          }
        : undefined,
    });
  };

  const handleWarmupActivityChange = (activity: WarmupActivity) => {
    if (currentSettings.workoutWarmup) {
      onSettingsChange({
        ...currentSettings,
        workoutWarmup: {
          ...currentSettings.workoutWarmup,
          activity,
        },
      });
    }
  };

  const handleWarmupDurationChange = (durationSec: number) => {
    if (currentSettings.workoutWarmup) {
      onSettingsChange({
        ...currentSettings,
        workoutWarmup: {
          ...currentSettings.workoutWarmup,
          durationSec,
        },
      });
    }
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors py-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Workout Settings</CardTitle>
          </div>
          <Button variant="ghost" size="sm" className="p-0 h-auto">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6 pt-0">
          {/* Default Rest Settings */}
          <div className="border rounded-lg overflow-hidden">
            <div className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium">Default Rest After Exercise</span>
              <Select
                value={currentSettings.defaultRestType}
                onValueChange={(value: RestType) => handleRestTypeChange(value)}
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

            {currentSettings.defaultRestType === 'timed' ? (
              <div className="p-3 pt-0 space-y-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Duration</span>
                  <span className="text-sm font-medium">
                    {formatDuration(currentSettings.defaultRestSec || 30)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-8">0s</span>
                  <Slider
                    value={[currentSettings.defaultRestSec || 30]}
                    onValueChange={(values) => handleRestSecChange(values[0])}
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
              <div className="p-3 pt-0 border-t">
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  Press lap button when ready to continue to next exercise
                </p>
              </div>
            )}
          </div>

          {/* Workout Warm-Up */}
          <div className="border rounded-lg overflow-hidden">
            <div className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <Switch
                  checked={currentSettings.workoutWarmup?.enabled || false}
                  onCheckedChange={handleWarmupToggle}
                />
                <span className="text-sm font-medium">Workout Warm-Up</span>
              </div>
            </div>

            {currentSettings.workoutWarmup?.enabled && (
              <div className="p-3 pt-0 space-y-4 border-t">
                {/* Warm-up Activity */}
                <div className="space-y-2">
                  <Label className="text-sm">Activity</Label>
                  <Select
                    value={currentSettings.workoutWarmup.activity}
                    onValueChange={(value: WarmupActivity) => handleWarmupActivityChange(value)}
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
                      {formatDuration(currentSettings.workoutWarmup.durationSec)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[currentSettings.workoutWarmup.durationSec]}
                      onValueChange={(values) => handleWarmupDurationChange(values[0])}
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
            <div className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <Switch
                  checked={currentSettings.autoAddPeriods || false}
                  onCheckedChange={(checked) => {
                    onSettingsChange({
                      ...currentSettings,
                      autoAddPeriods: checked,
                    });
                  }}
                />
                <div>
                  <span className="text-sm font-medium">Auto-add Warm-up & Rest</span>
                  <p className="text-xs text-muted-foreground">
                    Automatically add 5-min warm-up, 60-90s rest periods, and 5-min cooldown for strength workouts
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
