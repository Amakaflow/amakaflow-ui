import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { mixWorkouts } from '../../lib/workout-operations-api';
import { MixPreviewWorkout, MixSource } from '../../types/workout-operations';
import { WorkoutEditorInline } from '../WorkoutEditor/WorkoutEditorInline';
import { WorkoutCoreData } from '../WorkoutEditor/WorkoutEditorCore';
import { BlockData } from '../WorkoutEditor/primitives/BlockSection';

interface MixPreviewStepProps {
  sources: MixSource[];
  title: string;
  onTitleChange: (title: string) => void;
  onPreviewReady: (preview: MixPreviewWorkout) => void;
}

export function MixPreviewStep({ sources, title, onTitleChange, onPreviewReady }: MixPreviewStepProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MixPreviewWorkout | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    mixWorkouts(sources, title)
      .then(res => {
        if (cancelled) return;
        setPreview(res.preview);
        onPreviewReady(res.preview);
      })
      .catch(e => {
        if (cancelled) return;
        setError((e as Error).message || 'Failed to generate preview');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]); // Only re-fires on explicit retry, not on every title change

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Generating preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-400">{error}</p>
        <button onClick={() => setRetryKey(k => k + 1)} className="flex items-center gap-1 text-sm text-primary underline">
          <RefreshCw aria-hidden="true" className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (!preview) return null;

  const workoutData: WorkoutCoreData = {
    title: preview.workout.title,
    blocks: preview.workout.blocks as unknown as BlockData[],
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Preview</h3>
        <p className="text-sm text-muted-foreground">Review and optionally edit the mixed workout before saving.</p>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Workout Title</label>
        <input
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          className="w-full bg-white/10 rounded-xl px-3 py-2 text-sm outline-none"
          placeholder="Enter title..."
        />
      </div>
      <WorkoutEditorInline
        workoutData={workoutData}
        onApplyOps={async () => {}}
      />
    </div>
  );
}
