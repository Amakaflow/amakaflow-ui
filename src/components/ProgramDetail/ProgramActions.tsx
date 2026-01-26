/**
 * ProgramActions - Dropdown menu with program actions (Activate, Pause, Archive, Delete)
 */

import { useState } from 'react';
import { MoreVertical, Play, Pause, Archive, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
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
import type { TrainingProgram, ProgramStatus } from '../../types/training-program';

interface ProgramActionsProps {
  program: TrainingProgram;
  onStatusChange: (status: ProgramStatus) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  isLoading?: boolean;
}

export function ProgramActions({
  program,
  onStatusChange,
  onDelete,
  isLoading,
}: ProgramActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await onDelete();
    setIsDeleting(false);
    if (success) {
      setShowDeleteDialog(false);
    }
  };

  const handleStatusChange = async (status: ProgramStatus) => {
    await onStatusChange(status);
  };

  // Determine primary action based on current status
  const getPrimaryAction = () => {
    switch (program.status) {
      case 'draft':
        return {
          label: 'Activate',
          icon: Play,
          status: 'active' as ProgramStatus,
        };
      case 'active':
        return {
          label: 'Pause',
          icon: Pause,
          status: 'paused' as ProgramStatus,
        };
      case 'paused':
        return {
          label: 'Resume',
          icon: Play,
          status: 'active' as ProgramStatus,
        };
      case 'completed':
        return {
          label: 'Archive',
          icon: Archive,
          status: 'archived' as ProgramStatus,
        };
      case 'archived':
        return {
          label: 'Restore',
          icon: RotateCcw,
          status: 'paused' as ProgramStatus,
        };
      default:
        return null;
    }
  };

  const primaryAction = getPrimaryAction();

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Primary action button */}
        {primaryAction && (
          <Button
            variant={program.status === 'active' ? 'outline' : 'default'}
            size="sm"
            onClick={() => handleStatusChange(primaryAction.status)}
            disabled={isLoading}
            className="gap-1.5"
          >
            <primaryAction.icon className="w-4 h-4" />
            {primaryAction.label}
          </Button>
        )}

        {/* More actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isLoading}>
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {program.status !== 'active' && program.status !== 'completed' && (
              <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                <Play className="w-4 h-4 mr-2" />
                Activate
              </DropdownMenuItem>
            )}
            {program.status === 'active' && (
              <DropdownMenuItem onClick={() => handleStatusChange('paused')}>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </DropdownMenuItem>
            )}
            {program.status !== 'archived' && program.status !== 'draft' && (
              <DropdownMenuItem onClick={() => handleStatusChange('archived')}>
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </DropdownMenuItem>
            )}
            {program.status === 'archived' && (
              <DropdownMenuItem onClick={() => handleStatusChange('paused')}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Restore
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Program
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          // Prevent closing the dialog while deletion is in progress
          if (!isDeleting) {
            setShowDeleteDialog(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Program?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{program.name}&rdquo;? This will
              permanently remove the program and all associated data. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
