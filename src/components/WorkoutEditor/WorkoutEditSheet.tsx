import { useState } from 'react';
import { X, Save, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { WorkoutEditorCore, WorkoutCoreData } from './WorkoutEditorCore';
import { WorkoutOperation } from '../../types/workout-operations';
import { applyWorkoutOperations } from '../../lib/workout-operations-api';

interface WorkoutEditSheetWorkout {
  id: string;
  title: string;
  updated_at: string;
  workout_data: WorkoutCoreData;
}

interface WorkoutEditSheetProps {
  workout: WorkoutEditSheetWorkout;
  open: boolean;
  onClose: () => void;
  onSaved: (updatedWorkout: WorkoutEditSheetWorkout) => void;
}

export function WorkoutEditSheet({ workout, open, onClose, onSaved }: WorkoutEditSheetProps) {
  const [pendingOps, setPendingOps] = useState<WorkoutOperation[]>([]);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleChange = (ops: WorkoutOperation[]) => {
    setPendingOps(ops);
    setConflict(false);
    setError(null);
  };

  const handleSave = async () => {
    if (pendingOps.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const result = await applyWorkoutOperations(workout.id, pendingOps, workout.updated_at);
      onSaved({
        ...workout,
        title: (result.workout as any).title ?? workout.title,
        updated_at: (result.workout as any).updated_at ?? workout.updated_at,
        workout_data: (result.workout as any).workout_data ?? workout.workout_data,
      });
      onClose();
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      if (err.status === 409) {
        setConflict(true);
      } else {
        setError(err.message || 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] flex flex-col rounded-t-2xl bg-background border-t border-white/10">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <h2 className="text-lg font-semibold">Edit Workout</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Banner */}
        {conflict && (
          <div className="mx-4 mb-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-400 font-medium">Workout was updated elsewhere</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your changes have been discarded.</p>
              </div>
              <button
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                onClick={onClose}
              >
                <RefreshCw className="w-3 h-3" />
                Reload
              </button>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mb-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <WorkoutEditorCore
            key={workout.id}
            initialWorkout={workout.workout_data}
            onChange={(ops: WorkoutOperation[], _updatedWorkout: WorkoutCoreData) => handleChange(ops)}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 bg-background">
          <Button
            onClick={handleSave}
            disabled={pendingOps.length === 0 || saving}
            className="w-full"
            size="lg"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />Save Changes</>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
