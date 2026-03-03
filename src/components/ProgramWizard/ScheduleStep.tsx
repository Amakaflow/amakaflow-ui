'use client';

import { useProgramWizard } from '@/context/ProgramWizardContext';
import { SessionDuration, DayOfWeek, DAYS_OF_WEEK, DAY_LABELS } from '@/types/program-wizard';
import { Slider } from '@/components/ui/slider';
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
        <h2 className="text-xl font-semibold text-foreground">
          Plan your schedule
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set your program duration and training frequency
        </p>
      </div>

      {/* Duration Weeks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Program Duration
          </label>
          <span className="text-sm font-semibold text-foreground">
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
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>4 weeks</span>
          <span>52 weeks</span>
        </div>
      </div>

      {/* Sessions Per Week */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Sessions Per Week
          </label>
          <span className="text-sm font-semibold text-foreground">
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
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1 session</span>
          <span>7 sessions</span>
        </div>
      </div>

      {/* Preferred Days */}
      <div className="space-y-4">
        <label className="text-sm font-medium text-foreground">
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
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary'
                )}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    'w-4 h-4 rounded flex items-center justify-center border',
                    isSelected
                      ? 'border-transparent bg-white'
                      : 'border-gray-300'
                  )}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-primary" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-medium">{DAY_LABELS[day].short}</span>
              </button>
            );
          })}
        </div>
        {state.preferredDays.length === 0 && (
          <p className="text-xs text-amber-600">
            Please select at least one training day
          </p>
        )}
      </div>

      {/* Time Per Session */}
      <div className="space-y-4">
        <label className="text-sm font-medium text-foreground">
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
                    ? 'border-primary bg-secondary text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary'
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
