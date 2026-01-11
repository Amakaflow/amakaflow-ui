/**
 * ClearDataModal component (AMA-306)
 *
 * Modal for clearing user data with preview and confirmation.
 * Requires typing "CLEAR" to confirm and calls the reset-user-data endpoint.
 */

import { useState, useEffect } from 'react';
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
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, AlertTriangle, Dumbbell, CheckCircle2, Calendar, Star, Tag, FolderOpen, Video } from 'lucide-react';
import { DeletionPreview, getDataSummary, clearUserData } from '../../lib/account-api';
import { toast } from 'sonner';

interface ClearDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataCleared?: () => void;
}

export function ClearDataModal({ open, onOpenChange, onDataCleared }: ClearDataModalProps) {
  const [dataSummary, setDataSummary] = useState<DeletionPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch data summary when modal opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setError(null);
      setConfirmText('');

      getDataSummary()
        .then((data) => {
          setDataSummary(data);
        })
        .catch((err) => {
          console.error('Failed to fetch data summary:', err);
          setError('Failed to load your data. Please try again.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open]);

  const handleClearData = async () => {
    if (confirmText !== 'CLEAR') {
      toast.error('Please type CLEAR to confirm');
      return;
    }

    setIsClearing(true);
    setError(null);

    try {
      await clearUserData();

      toast.success('All your data has been cleared successfully');
      onOpenChange(false);
      onDataCleared?.();
    } catch (err: any) {
      console.error('Failed to clear user data:', err);
      setError(err.message || 'Failed to clear data. Please try again.');
      toast.error(err.message || 'Failed to clear data');
    } finally {
      setIsClearing(false);
    }
  };

  const handleClose = () => {
    if (!isClearing) {
      setConfirmText('');
      setError(null);
      setDataSummary(null);
      onOpenChange(false);
    }
  };

  const isConfirmEnabled = confirmText === 'CLEAR' && !isClearing && !isLoading;

  // Calculate hasData from individual counts (more robust than relying on total_items)
  const hasData = dataSummary && (
    dataSummary.workouts > 0 ||
    dataSummary.workout_completions > 0 ||
    dataSummary.programs > 0 ||
    dataSummary.tags > 0 ||
    dataSummary.follow_along_workouts > 0 ||
    dataSummary.paired_devices > 0 ||
    dataSummary.voice_corrections > 0
  );

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            Clear User Data
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto">
              <p>
                This will permanently delete all your workout data. Your account,
                settings, and connected apps will be kept.
              </p>

              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading your data...</span>
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Data Preview */}
              {dataSummary && !isLoading && (
                <div className="space-y-3">
                  <p className="font-medium text-foreground">This will permanently delete:</p>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    {dataSummary.workouts > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Dumbbell className="w-4 h-4 text-muted-foreground" />
                          <span>Workouts</span>
                        </div>
                        <span className="font-medium text-foreground">{dataSummary.workouts}</span>
                      </div>
                    )}
                    {dataSummary.workout_completions > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                          <span>Completions</span>
                        </div>
                        <span className="font-medium text-foreground">{dataSummary.workout_completions}</span>
                      </div>
                    )}
                    {dataSummary.follow_along_workouts > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Video className="w-4 h-4 text-muted-foreground" />
                          <span>Follow-along Workouts</span>
                        </div>
                        <span className="font-medium text-foreground">{dataSummary.follow_along_workouts}</span>
                      </div>
                    )}
                    {dataSummary.programs > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="w-4 h-4 text-muted-foreground" />
                          <span>Programs</span>
                        </div>
                        <span className="font-medium text-foreground">{dataSummary.programs}</span>
                      </div>
                    )}
                    {dataSummary.tags > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-muted-foreground" />
                          <span>Tags</span>
                        </div>
                        <span className="font-medium text-foreground">{dataSummary.tags}</span>
                      </div>
                    )}
                    {dataSummary.voice_corrections > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">🎤</span>
                          <span>Voice Corrections</span>
                        </div>
                        <span className="font-medium text-foreground">{dataSummary.voice_corrections}</span>
                      </div>
                    )}
                    {dataSummary.paired_devices > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">📱</span>
                          <span>Paired Devices</span>
                        </div>
                        <span className="font-medium text-foreground">{dataSummary.paired_devices}</span>
                      </div>
                    )}
                    {!hasData && (
                      <p className="text-sm text-muted-foreground italic text-center py-2">
                        No data to clear
                      </p>
                    )}
                  </div>

                  {/* What's Kept */}
                  <Alert className="bg-green-500/10 border-green-500/30">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                      <strong>Kept:</strong> Your account, settings, and connected apps (Strava, Garmin) will remain.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* CLEAR Confirmation */}
              {hasData && !isLoading && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="clear-confirm" className="text-foreground font-medium">
                    Type "CLEAR" to confirm
                  </Label>
                  <Input
                    id="clear-confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    placeholder="CLEAR"
                    className="font-mono"
                    disabled={isClearing}
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isClearing} onClick={handleClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleClearData}
            disabled={!isConfirmEnabled || !hasData}
            className="!bg-amber-600 !text-white hover:!bg-amber-700 disabled:!bg-amber-400 disabled:!opacity-100 disabled:!cursor-not-allowed"
          >
            {isClearing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Clearing...
              </>
            ) : (
              'Clear All Data'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
