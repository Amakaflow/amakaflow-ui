import { Check } from 'lucide-react';
import { UnifiedWorkout, isHistoryWorkout } from '../../types/unified-workout';
import { cn } from '../ui/utils';

export interface BlockSelection {
  workoutId: string;
  blockIndex: number;
}

interface SelectBlocksStepProps {
  workouts: UnifiedWorkout[];
  selectedWorkoutIds: string[];
  selectedBlocks: BlockSelection[];
  onToggleBlock: (selection: BlockSelection) => void;
}

function getBlocks(workout: UnifiedWorkout): Array<{ label?: string; exerciseCount: number }> {
  if (!isHistoryWorkout(workout)) return [];
  const data = workout._original.data as { workout_data?: { blocks?: Array<{ label?: string; exercises?: unknown[] }> } };
  const blocks = data.workout_data?.blocks ?? [];
  return blocks.map(b => ({ label: b.label, exerciseCount: (b.exercises ?? []).length }));
}

export function SelectBlocksStep({ workouts, selectedWorkoutIds, selectedBlocks, onToggleBlock }: SelectBlocksStepProps) {
  const sourceWorkouts = workouts.filter(w => selectedWorkoutIds.includes(w.id));
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Select Blocks</h3>
        <p className="text-sm text-muted-foreground">Choose which blocks to include in the mixed workout.</p>
      </div>
      <div className="space-y-4 max-h-[55vh] overflow-y-auto">
        {sourceWorkouts.map(workout => {
          const blocks = getBlocks(workout);
          return (
            <div key={workout.id}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{workout.title}</p>
              <div className="space-y-1">
                {blocks.map((block, bi) => {
                  const isSelected = selectedBlocks.some(s => s.workoutId === workout.id && s.blockIndex === bi);
                  return (
                    <button
                      key={bi}
                      onClick={() => onToggleBlock({ workoutId: workout.id, blockIndex: bi })}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                        isSelected ? 'border-primary/50 bg-primary/5' : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
                      )}
                    >
                      <div className={cn('w-5 h-5 rounded border flex items-center justify-center flex-shrink-0', isSelected ? 'bg-primary border-primary' : 'border-white/30')}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{block.label || `Block ${bi + 1}`}</span>
                        <span className="text-xs text-muted-foreground ml-2">{block.exerciseCount} exercise{block.exerciseCount !== 1 ? 's' : ''}</span>
                      </div>
                    </button>
                  );
                })}
                {blocks.length === 0 && <p className="text-xs text-muted-foreground pl-2">No blocks found</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
