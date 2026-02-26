import { useCallback, useState } from 'react';
import { WorkoutEditorCore, WorkoutCoreData } from './WorkoutEditorCore';
import { WorkoutOperation } from '../../types/workout-operations';
import { AlertCircle, Loader2 } from 'lucide-react';

interface WorkoutEditorInlineProps {
  /** Current workout data to render */
  workout: WorkoutCoreData;
  /** Called with the latest single op; should return updated workout or throw */
  onApplyOps: (ops: WorkoutOperation[]) => Promise<WorkoutCoreData>;
  /** Called after each successful op application with the new workout */
  onUpdate: (updated: WorkoutCoreData) => void;
}

export function WorkoutEditorInline({ workout, onApplyOps, onUpdate }: WorkoutEditorInlineProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(async (ops: WorkoutOperation[]) => {
    // Send only the latest op
    const latestOp = ops[ops.length - 1];
    if (!latestOp) return;

    setSaving(true);
    setError(null);
    try {
      const updated = await onApplyOps([latestOp]);
      onUpdate(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setSaving(false);
    }
  }, [onApplyOps, onUpdate]);

  return (
    <div className="space-y-3">
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
        initialWorkout={workout}
        onChange={handleChange}
      />
    </div>
  );
}
