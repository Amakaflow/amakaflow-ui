import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { UnifiedWorkout } from '../../types/unified-workout';
import { MixPreviewWorkout, MixSource } from '../../types/workout-operations';
import { SelectWorkoutsStep } from './SelectWorkoutsStep';
import { SelectBlocksStep, BlockSelection } from './SelectBlocksStep';
import { MixPreviewStep } from './MixPreviewStep';

type WizardStep = 1 | 2 | 3;


interface MixWizardModalProps {
  open: boolean;
  workouts: UnifiedWorkout[];
  onClose: () => void;
  onSave: (preview: MixPreviewWorkout, title: string) => void;
}

export function MixWizardModal({ open, workouts, onClose, onSave }: MixWizardModalProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<string[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<BlockSelection[]>([]);
  const [mixTitle, setMixTitle] = useState('Mixed Workout');
  const [preview, setPreview] = useState<MixPreviewWorkout | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const toggleWorkout = (id: string) => {
    setSelectedWorkoutIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleBlock = (sel: BlockSelection) => {
    setSelectedBlocks(prev => {
      const exists = prev.some(s => s.workoutId === sel.workoutId && s.blockIndex === sel.blockIndex);
      return exists
        ? prev.filter(s => !(s.workoutId === sel.workoutId && s.blockIndex === sel.blockIndex))
        : [...prev, sel];
    });
  };

  const buildSources = (): MixSource[] => {
    return selectedWorkoutIds.map(wid => ({
      workout_id: wid,
      block_indices: selectedBlocks.filter(s => s.workoutId === wid).map(s => s.blockIndex),
    })).filter(s => s.block_indices.length > 0);
  };

  const handleNext = () => {
    if (step === 1) {
      const allBlocks: BlockSelection[] = [];
      for (const wid of selectedWorkoutIds) {
        const w = workouts.find(x => x.id === wid);
        const data = (w?._original?.data as any);
        const blocks = data?.workout_data?.blocks || data?.workout?.blocks || [];
        blocks.forEach((_: unknown, bi: number) => allBlocks.push({ workoutId: wid, blockIndex: bi }));
      }
      setSelectedBlocks(allBlocks);
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      onSave(preview, mixTitle);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const canNext = (step === 1 && selectedWorkoutIds.length >= 2) || (step === 2 && selectedBlocks.length > 0);
  const nextLabel = step === 2 ? 'Preview' : 'Next';

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="mix-wizard-title" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="w-full max-w-lg bg-background rounded-2xl border border-white/10 flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div>
              <h2 id="mix-wizard-title" className="text-lg font-semibold">Mix Workouts</h2>
              <p className="text-sm text-muted-foreground">Step {step} of 3</p>
            </div>
            <button aria-label="Close" onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-1 px-5 pt-3">
            {([1, 2, 3] as WizardStep[]).map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-primary' : 'bg-white/10'}`} />
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {step === 1 && <SelectWorkoutsStep workouts={workouts} selected={selectedWorkoutIds} onToggle={toggleWorkout} />}
            {step === 2 && <SelectBlocksStep workouts={workouts} selectedWorkoutIds={selectedWorkoutIds} selectedBlocks={selectedBlocks} onToggleBlock={toggleBlock} />}
            {step === 3 && <MixPreviewStep sources={buildSources()} title={mixTitle} onTitleChange={setMixTitle} onPreviewReady={setPreview} />}
          </div>

          <div className="px-5 py-4 border-t border-white/10 flex items-center gap-3">
            {step > 1 && (
              <Button variant="ghost" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-1" />Back
              </Button>
            )}
            <div className="flex-1" />
            {step < 3 ? (
              <Button onClick={handleNext} disabled={!canNext}>
                {nextLabel}<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={!preview || saving}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Workout</>}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
