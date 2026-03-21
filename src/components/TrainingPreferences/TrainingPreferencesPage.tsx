import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Slider } from '../ui/slider';
import { Checkbox } from '../ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  ArrowLeft,
  RotateCcw,
  Clock,
  Flame,
  CalendarDays,
  Target,
  Sun,
  RefreshCw,
  Timer,
} from 'lucide-react';
import { cn } from '../ui/utils';
import {
  useTrainingPreferences,
  VOLUME_PRESET_RANGES,
  GOAL_RACE_LABELS,
  DAY_LABELS,
  ALL_DAYS,
  type WeeklyVolumePreset,
  type WorkoutTime,
  type GoalRace,
  type DeloadInterval,
} from '../../hooks/useTrainingPreferences';

interface TrainingPreferencesPageProps {
  onBack: () => void;
}

const WORKOUT_TIME_OPTIONS: { value: WorkoutTime; label: string; icon: string }[] = [
  { value: 'morning', label: 'Morning', icon: '🌅' },
  { value: 'lunchtime', label: 'Lunchtime', icon: '☀️' },
  { value: 'evening', label: 'Evening', icon: '🌙' },
  { value: 'flexible', label: 'Flexible', icon: '🔄' },
];

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function TrainingPreferencesPage({ onBack }: TrainingPreferencesPageProps) {
  const { preferences, isDirty, updatePreference, resetToDefaults, toggleRunDay } = useTrainingPreferences();

  return (
    <div className="min-h-screen bg-background" data-testid="training-preferences-page">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Training Preferences</h1>
            <p className="text-xs text-muted-foreground">Configure your AI training plan</p>
          </div>
          {isDirty && (
            <Button variant="outline" size="sm" onClick={resetToDefaults} aria-label="Reset to defaults">
              <RotateCcw className="size-4 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Weekly Volume */}
        <Card data-testid="weekly-volume-section">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-primary" />
              Weekly Volume
            </CardTitle>
            <CardDescription>Total training hours per week</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-2" data-testid="volume-preset-buttons">
              {(['low', 'moderate', 'high', 'custom'] as WeeklyVolumePreset[]).map(preset => (
                <Button
                  key={preset}
                  variant={preferences.weeklyVolumePreset === preset ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => updatePreference('weeklyVolumePreset', preset)}
                  data-testid={`volume-${preset}`}
                >
                  {preset === 'custom' ? 'Custom' : VOLUME_PRESET_RANGES[preset].label.split(' ')[0]}
                </Button>
              ))}
            </div>
            {preferences.weeklyVolumePreset !== 'custom' && (
              <p className="text-sm text-muted-foreground" data-testid="volume-range-label">
                {VOLUME_PRESET_RANGES[preferences.weeklyVolumePreset].label}
              </p>
            )}
            {preferences.weeklyVolumePreset === 'custom' && (
              <div className="space-y-2" data-testid="custom-volume-slider">
                <div className="flex justify-between items-center">
                  <Label>Custom hours</Label>
                  <span className="text-sm font-medium">{preferences.weeklyVolumeCustomHours}h</span>
                </div>
                <Slider
                  min={1}
                  max={15}
                  step={0.5}
                  value={[preferences.weeklyVolumeCustomHours]}
                  onValueChange={([v]) => updatePreference('weeklyVolumeCustomHours', v)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1h</span>
                  <span>15h</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hard Days Per Week */}
        <Card data-testid="hard-days-section">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="size-4 text-orange-500" />
              Hard Days Per Week
            </CardTitle>
            <CardDescription>Number of high-intensity sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2" data-testid="hard-days-buttons">
              {[1, 2, 3, 4].map(n => (
                <Button
                  key={n}
                  variant={preferences.hardDaysPerWeek === n ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => updatePreference('hardDaysPerWeek', n)}
                  data-testid={`hard-days-${n}`}
                >
                  {n}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Max Session Length */}
        <Card data-testid="max-session-section">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="size-4 text-primary" />
              Max Session Length
            </CardTitle>
            <CardDescription>Longest workout you want in a single session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Duration</Label>
              <span className="text-sm font-medium" data-testid="session-length-display">
                {formatMinutes(preferences.maxSessionLengthMinutes)}
              </span>
            </div>
            <Slider
              min={30}
              max={180}
              step={15}
              value={[preferences.maxSessionLengthMinutes]}
              onValueChange={([v]) => updatePreference('maxSessionLengthMinutes', v)}
              data-testid="session-length-slider"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>30min</span>
              <span>3h</span>
            </div>
          </CardContent>
        </Card>

        {/* Preferred Run Days */}
        <Card data-testid="run-days-section">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-primary" />
              Preferred Run Days
            </CardTitle>
            <CardDescription>Days you prefer to run or train</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1" data-testid="run-days-checkboxes">
              {ALL_DAYS.map(day => {
                const checked = preferences.preferredRunDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleRunDay(day)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg py-2 px-1 text-xs font-medium transition-colors border',
                      checked
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-input hover:bg-accent'
                    )}
                    data-testid={`run-day-${day}`}
                    aria-pressed={checked}
                    aria-label={`${DAY_LABELS[day]}${checked ? ' selected' : ''}`}
                  >
                    {DAY_LABELS[day]}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Preferred Workout Time */}
        <Card data-testid="workout-time-section">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sun className="size-4 text-yellow-500" />
              Preferred Workout Time
            </CardTitle>
            <CardDescription>When do you prefer to train?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2" data-testid="workout-time-buttons">
              {WORKOUT_TIME_OPTIONS.map(option => (
                <Button
                  key={option.value}
                  variant={preferences.preferredWorkoutTime === option.value ? 'default' : 'outline'}
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => updatePreference('preferredWorkoutTime', option.value)}
                  data-testid={`workout-time-${option.value}`}
                >
                  <span>{option.icon}</span>
                  {option.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Goal Race */}
        <Card data-testid="goal-race-section">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4 text-red-500" />
              Goal Race
            </CardTitle>
            <CardDescription>Target event for your training plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={preferences.goalRace}
              onValueChange={(v) => updatePreference('goalRace', v as GoalRace)}
            >
              <SelectTrigger data-testid="goal-race-select">
                <SelectValue placeholder="Select a goal race" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(GOAL_RACE_LABELS) as [GoalRace, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value} data-testid={`goal-race-option-${value}`}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {preferences.goalRace !== 'none' && (
              <div className="space-y-2" data-testid="goal-race-date-section">
                <Label>Race Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !preferences.goalRaceDate && 'text-muted-foreground'
                      )}
                      data-testid="goal-race-date-trigger"
                    >
                      <CalendarDays className="mr-2 size-4" />
                      {preferences.goalRaceDate
                        ? new Date(preferences.goalRaceDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : 'Pick a race date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={preferences.goalRaceDate ? new Date(preferences.goalRaceDate) : undefined}
                      onSelect={(date) => {
                        updatePreference('goalRaceDate', date ? date.toISOString().split('T')[0] : null);
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </CardContent>
        </Card>

        {/* De-load Interval */}
        <Card data-testid="deload-section">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="size-4 text-green-500" />
              De-load Interval
            </CardTitle>
            <CardDescription>How often to schedule a recovery week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2" data-testid="deload-buttons">
              {([3, 4, 5] as DeloadInterval[]).map(n => (
                <Button
                  key={n}
                  variant={preferences.deloadInterval === n ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => updatePreference('deloadInterval', n)}
                  data-testid={`deload-${n}`}
                >
                  Every {n} weeks
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
