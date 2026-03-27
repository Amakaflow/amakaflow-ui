import { useCallback, useState } from 'react';
import { WorkoutEditorCore, WorkoutCoreData } from './WorkoutEditorCore';
import { WorkoutOperation } from '../../types/workout-operations';
import { AlertCircle, Loader2 } from 'lucide-react';

interface WorkoutEditorInlineProps {
  /** Current workout data to render */
  workoutData: WorkoutCoreData;
  /** Called with the latest single op; resolves on success, rejects on failure */
  onApplyOps(ops: WorkoutOperation[]): Promise<void>;
  /** Optional className applied to the outer wrapper div */
  className?: string;
}

export function WorkoutEditorInline({ workoutData, onApplyOps, className }: WorkoutEditorInlineProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(async (ops: WorkoutOperation[], _updatedWorkout: WorkoutCoreData) => {
    // Send only the latest op
    const latestOp = ops[ops.length - 1];
    if (!latestOp) return;

    setSaving(true);
    setError(null);
    try {
      await onApplyOps([latestOp]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setSaving(false);
    }
  }, [onApplyOps]);

  return (
    <div className={className ? `space-y-3 ${className}` : 'space-y-3'}>
      {saving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Saving...
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <WorkoutEditorCore
        initialWorkout={workoutData}
        onChange={handleChange}
      />
    </div>
  );
}
