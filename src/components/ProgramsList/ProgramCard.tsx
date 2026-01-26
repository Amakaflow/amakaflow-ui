/**
 * ProgramCard - Card component for displaying training programs
 * Shows different information based on program status
 */

import { useState } from 'react';
import {
  Calendar,
  Clock,
  Dumbbell,
  Eye,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Card } from '../ui/card';
import type { TrainingProgram } from '../../types/training-program';
import { STATUS_LABELS } from '../../types/training-program';

interface ProgramCardProps {
  program: TrainingProgram;
  loadingAction?: string;
  onView: () => void;
  onActivate: () => void;
  onPause: () => void;
  onDelete: () => void;
}

export function ProgramCard({
  program,
  loadingAction,
  onView,
  onActivate,
  onPause,
  onDelete,
}: ProgramCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const progress = program.duration_weeks > 0
    ? Math.round(((program.current_week - 1) / program.duration_weeks) * 100)
    : 0;

  const statusConfig = STATUS_LABELS[program.status];
  const programName = program.name || 'Untitled Program';

  // Format date helper
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onView();
    }
  };

  // Render status-specific content
  const renderStatusContent = () => {
    switch (program.status) {
      case 'active':
        return (
          <>
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  Week {program.current_week} of {program.duration_weeks}
                </span>
              </div>
              <Progress
                value={progress}
                aria-label={`Program progress: ${progress}%`}
              />
            </div>
            {/* Next workout info */}
            <div className="text-sm text-muted-foreground">
              {program.started_at && (
                <span>Started {formatDate(program.started_at)}</span>
              )}
            </div>
          </>
        );

      case 'draft':
        return (
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {program.duration_weeks} weeks
              </span>
              <span className="flex items-center gap-1">
                <Dumbbell className="w-3.5 h-3.5" />
                {program.sessions_per_week}x/week
              </span>
            </div>
            <p>Created {formatDate(program.created_at)}</p>
          </div>
        );

      case 'completed':
        return (
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {program.duration_weeks} weeks
              </span>
            </div>
            {program.completed_at && (
              <p>Completed {formatDate(program.completed_at)}</p>
            )}
          </div>
        );

      case 'paused':
        return (
          <>
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress (Paused)</span>
                <span className="font-medium">
                  Week {program.current_week} of {program.duration_weeks}
                </span>
              </div>
              <Progress
                value={progress}
                className="opacity-60"
                aria-label={`Program progress: ${progress}% (paused)`}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  // Render status-specific actions
  const renderActions = () => {
    const isLoading = !!loadingAction;

    switch (program.status) {
      case 'active':
        return (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onPause();
            }}
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isLoading}
          >
            {loadingAction === 'pause' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
            Pause
          </Button>
        );

      case 'draft':
      case 'paused':
        return (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onActivate();
            }}
            size="sm"
            className="gap-1.5"
            disabled={isLoading}
          >
            {loadingAction === 'activate' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Activate
          </Button>
        );

      case 'completed':
        return (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </Button>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Card
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors border-l-4 border-l-primary focus:ring-2 focus:ring-primary focus:outline-none"
        onClick={onView}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`View program: ${programName}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{programName}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Dumbbell className="w-3 h-3" />
                  {program.sessions_per_week}/week
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {program.time_per_session_minutes}min
                </span>
              </div>
            </div>
          </div>
          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
        </div>

        {/* Status-specific content */}
        <div className="space-y-3 mb-4">{renderStatusContent()}</div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">{renderActions()}</div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="w-4 h-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {program.status === 'active' && (
                <DropdownMenuItem onClick={onPause} disabled={!!loadingAction}>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause Program
                </DropdownMenuItem>
              )}
              {(program.status === 'draft' || program.status === 'paused') && (
                <DropdownMenuItem onClick={onActivate} disabled={!!loadingAction}>
                  <Play className="w-4 h-4 mr-2" />
                  Activate Program
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
                className="text-destructive focus:text-destructive"
                disabled={!!loadingAction}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Program
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Program?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {program.name ? `"${program.name}"` : 'this program'} and all its scheduled
              workouts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteDialog(false);
                onDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ProgramCard;
