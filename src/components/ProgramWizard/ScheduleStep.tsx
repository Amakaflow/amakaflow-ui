'use client';

import { useProgramWizard } from '@/context/ProgramWizardContext';
import { SessionDuration, DayOfWeek, DAYS_OF_WEEK, DAY_LABELS } from '@/types/program-wizard';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/components/ui/utils';

const sessionDurations: SessionDuration[] = [30, 45, 60, 90];

export function ScheduleStep() {
  const {
    state,
    setDurationWeeks,
    setSessionsPerWeek,
    togglePreferredDay,
    setTimePerSession,
  } = useProgramWizard();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Plan your schedule
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Set your program duration and training frequency
        </p>
      </div>

      {/* Duration Weeks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Program Duration
          </label>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {state.durationWeeks} weeks
          </span>
        </div>
        <Slider
          value={[state.durationWeeks]}
          onValueChange={([value]) => setDurationWeeks(value)}
          min={4}
          max={52}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
          <span>4 weeks</span>
          <span>52 weeks</span>
        </div>
      </div>

      {/* Sessions Per Week */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Sessions Per Week
          </label>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {state.sessionsPerWeek} {state.sessionsPerWeek === 1 ? 'session' : 'sessions'}
          </span>
        </div>
        <Slider
          value={[state.sessionsPerWeek]}
          onValueChange={([value]) => setSessionsPerWeek(value)}
          min={1}
          max={7}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
          <span>1 session</span>
          <span>7 sessions</span>
        </div>
      </div>

      {/* Preferred Days */}
      <div className="space-y-4">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Preferred Training Days
        </label>
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = state.preferredDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => togglePreferredDay(day)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                  isSelected
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600'
                )}
              >
                <Checkbox
                  checked={isSelected}
                  className={cn(
                    'pointer-events-none',
                    isSelected && 'border-white data-[state=checked]:bg-white data-[state=checked]:text-zinc-900 dark:border-zinc-900 dark:data-[state=checked]:bg-zinc-900 dark:data-[state=checked]:text-white'
                  )}
                />
                <span className="text-sm font-medium">{DAY_LABELS[day].short}</span>
              </button>
            );
          })}
        </div>
        {state.preferredDays.length === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Please select at least one training day
          </p>
        )}
      </div>

      {/* Time Per Session */}
      <div className="space-y-4">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Time Per Session
        </label>
        <div className="grid grid-cols-4 gap-2">
          {sessionDurations.map((duration) => {
            const isSelected = state.timePerSession === duration;
            return (
              <button
                key={duration}
                type="button"
                onClick={() => setTimePerSession(duration)}
                className={cn(
                  'px-3 py-3 rounded-lg border-2 text-sm font-medium transition-colors',
                  isSelected
                    ? 'border-zinc-900 bg-zinc-50 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600'
                )}
              >
                {duration} min
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
