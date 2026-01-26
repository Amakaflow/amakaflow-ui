/**
 * WeeklyCalendar - Week tabs with day columns showing workout cards
 */

import { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { cn } from '../ui/utils';
import { WorkoutCard, RestDayCell } from './WorkoutCard';
import type { TrainingProgram, ProgramWeek, ProgramWorkout } from '../../types/training-program';
import { DAY_LABELS_SHORT } from '../../types/training-program';

interface WeeklyCalendarProps {
  program: TrainingProgram;
  selectedWeekNumber: number;
  selectedWorkout: ProgramWorkout | null;
  onSelectWeek: (weekNumber: number) => void;
  onSelectWorkout: (workout: ProgramWorkout) => void;
}

export function WeeklyCalendar({
  program,
  selectedWeekNumber,
  selectedWorkout,
  onSelectWeek,
  onSelectWorkout,
}: WeeklyCalendarProps) {
  const weekTabsRef = useRef<HTMLDivElement>(null);

  // Get current week data
  const currentWeek = program.weeks.find(
    (w) => w.week_number === selectedWeekNumber
  );

  // Scroll selected week into view
  useEffect(() => {
    if (weekTabsRef.current) {
      const selectedTab = weekTabsRef.current.querySelector(
        `[data-week="${selectedWeekNumber}"]`
      );
      if (selectedTab) {
        selectedTab.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [selectedWeekNumber]);

  // Group workouts by day
  const workoutsByDay: (ProgramWorkout | null)[] = Array(7).fill(null);
  currentWeek?.workouts.forEach((workout) => {
    if (workout.day_of_week >= 0 && workout.day_of_week < 7) {
      workoutsByDay[workout.day_of_week] = workout;
    }
  });

  // Navigation handlers
  const goToPrevWeek = () => {
    if (selectedWeekNumber > 1) {
      onSelectWeek(selectedWeekNumber - 1);
    }
  };

  const goToNextWeek = () => {
    if (selectedWeekNumber < program.weeks.length) {
      onSelectWeek(selectedWeekNumber + 1);
    }
  };

  return (
    <div className="space-y-4">
      {/* Week tabs with navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrevWeek}
          disabled={selectedWeekNumber === 1}
          className="flex-shrink-0"
          aria-label="Previous week"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <ScrollArea className="flex-1" type="scroll">
          <div
            ref={weekTabsRef}
            className="flex gap-2 p-1"
            role="tablist"
            aria-label="Program weeks"
          >
            {program.weeks.map((week) => (
              <WeekTab
                key={week.id}
                week={week}
                isSelected={week.week_number === selectedWeekNumber}
                isCurrent={week.week_number === program.current_week}
                onClick={() => onSelectWeek(week.week_number)}
                tabPanelId={`week-panel-${week.week_number}`}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextWeek}
          disabled={selectedWeekNumber >= program.weeks.length}
          className="flex-shrink-0"
          aria-label="Next week"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Week content panel */}
      <div
        id={`week-panel-${selectedWeekNumber}`}
        role="tabpanel"
        aria-labelledby={`week-tab-${selectedWeekNumber}`}
        className="space-y-4"
      >
        {/* Week info bar */}
        {currentWeek && (
          <div className="flex items-center gap-3 text-sm px-2">
            {currentWeek.focus && (
              <Badge variant="outline" className="capitalize">
                Focus: {currentWeek.focus}
              </Badge>
            )}
            {currentWeek.intensity_percentage && (
              <Badge variant="secondary">
                {currentWeek.intensity_percentage}% Intensity
              </Badge>
            )}
            {currentWeek.is_deload && (
              <Badge className="bg-blue-100 text-blue-800">
                Deload Week
              </Badge>
            )}
            {currentWeek.volume_modifier !== 1 && (
              <span className="text-muted-foreground">
                Volume: {Math.round(currentWeek.volume_modifier * 100)}%
              </span>
            )}
          </div>
        )}

        {/* Day columns grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {DAY_LABELS_SHORT.map((day, idx) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-muted-foreground pb-2"
            >
              {day}
            </div>
          ))}

          {/* Workout cards or rest day cells */}
          {workoutsByDay.map((workout, dayIndex) => (
            <div key={dayIndex} className="min-h-[120px]">
              {workout ? (
                <WorkoutCard
                  workout={workout}
                  onClick={() => onSelectWorkout(workout)}
                  isSelected={selectedWorkout?.id === workout.id}
                />
              ) : (
                <RestDayCell />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Week tab button component
 */
interface WeekTabProps {
  week: ProgramWeek;
  isSelected: boolean;
  isCurrent: boolean;
  onClick: () => void;
  tabPanelId: string;
}

function WeekTab({ week, isSelected, isCurrent, onClick, tabPanelId }: WeekTabProps) {
  // Calculate completion for the week
  const totalWorkouts = week.workouts.length;
  const completedWorkouts = week.workouts.filter((w) => w.is_completed).length;
  const isComplete = totalWorkouts > 0 && completedWorkouts === totalWorkouts;

  return (
    <button
      id={`week-tab-${week.week_number}`}
      role="tab"
      aria-selected={isSelected}
      aria-controls={tabPanelId}
      tabIndex={isSelected ? 0 : -1}
      data-week={week.week_number}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 px-4 py-2 rounded-lg border transition-all min-w-[80px]',
        isSelected
          ? 'bg-primary text-primary-foreground border-primary'
          : 'hover:bg-muted border-transparent',
        isCurrent && !isSelected && 'border-primary/50',
        isComplete && !isSelected && 'bg-green-50 dark:bg-green-950/20'
      )}
    >
      <div className="flex items-center gap-1">
        <span className="font-medium text-sm">Week {week.week_number}</span>
        {week.is_deload && (
          <Zap className="w-3 h-3" aria-label="Deload week" />
        )}
      </div>
      <span className="text-xs opacity-80">
        {completedWorkouts}/{totalWorkouts}
      </span>
    </button>
  );
}
