/**
 * WorkoutProgramCard - Collapsible program card with workout list
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Play,
  MoreHorizontal,
  Edit,
  Trash2,
  Plus,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import type { WorkoutProgram, ProgramMember } from '../lib/workout-api';
import type { UnifiedWorkout } from '../types/unified-workout';

interface WorkoutProgramCardProps {
  program: WorkoutProgram;
  workouts: UnifiedWorkout[];
  onStartNext: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddWorkout: () => void;
  onRemoveWorkout: (memberId: string) => void;
  onLoadWorkout: (workout: UnifiedWorkout) => void;
}

export function WorkoutProgramCard({
  program,
  workouts,
  onStartNext,
  onEdit,
  onDelete,
  onAddWorkout,
  onRemoveWorkout,
  onLoadWorkout,
}: WorkoutProgramCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalWorkouts = program.members?.length || 0;
  const currentDay = program.current_day_index + 1;
  const progress = totalWorkouts > 0 ? Math.round((currentDay / totalWorkouts) * 100) : 0;

  // Get workout for current day
  const currentMember = program.members?.find(
    (m) => m.day_order === program.current_day_index
  );
  const currentWorkout = currentMember
    ? workouts.find(
        (w) =>
          w.id === currentMember.workout_id ||
          w.id === currentMember.follow_along_id
      )
    : null;

  return (
    <div
      className="border rounded-lg overflow-hidden"
      style={{ borderLeftColor: program.color || '#3b82f6', borderLeftWidth: 4 }}
    >
      {/* Header - Always visible */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand/Collapse Icon */}
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </Button>

        {/* Program Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
          style={{ backgroundColor: (program.color || '#3b82f6') + '20' }}
        >
          {program.icon || '💪'}
        </div>

        {/* Program Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{program.name}</h3>
            <Badge variant="outline" className="text-xs">
              {totalWorkouts} workout{totalWorkouts !== 1 ? 's' : ''}
            </Badge>
          </div>
          {totalWorkouts > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-muted rounded-full max-w-[120px]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: program.color || '#3b82f6',
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                Day {currentDay} of {totalWorkouts}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {currentWorkout && (
            <Button
              size="sm"
              onClick={onStartNext}
              className="gap-1.5"
              style={{
                backgroundColor: program.color || '#3b82f6',
                color: 'white',
              }}
            >
              <Play className="w-3 h-3" />
              Start Day {currentDay}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Program
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddWorkout}>
                <Plus className="w-4 h-4 mr-2" />
                Add Workout
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Program
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Expanded Content - Workout List */}
      {isExpanded && (
        <div className="border-t bg-muted/20">
          {program.members && program.members.length > 0 ? (
            <div className="divide-y">
              {program.members
                .sort((a, b) => a.day_order - b.day_order)
                .map((member, index) => {
                  const workout = workouts.find(
                    (w) =>
                      w.id === member.workout_id ||
                      w.id === member.follow_along_id
                  );
                  const isCurrent = member.day_order === program.current_day_index;
                  const isCompleted = member.day_order < program.current_day_index;

                  return (
                    <div
                      key={member.id}
                      className={`flex items-center gap-3 px-4 py-2 ${
                        isCurrent ? 'bg-primary/10' : ''
                      }`}
                    >
                      {/* Day Number */}
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          isCompleted
                            ? 'bg-green-500 text-white'
                            : isCurrent
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {index + 1}
                      </div>

                      {/* Workout Info */}
                      <div className="flex-1 min-w-0">
                        {workout ? (
                          <button
                            onClick={() => onLoadWorkout(workout)}
                            className="text-left hover:underline"
                          >
                            <p className="font-medium truncate">{workout.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {workout.exerciseCount} exercises
                            </p>
                          </button>
                        ) : (
                          <p className="text-muted-foreground italic">
                            Workout not found
                          </p>
                        )}
                      </div>

                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                        onClick={() => onRemoveWorkout(member.id)}
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              <p className="text-sm">No workouts in this program yet.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddWorkout}
                className="mt-2 gap-1.5"
              >
                <Plus className="w-3 h-3" />
                Add Workout
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WorkoutProgramCard;
