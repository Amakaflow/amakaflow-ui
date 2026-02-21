import type { WorkoutStructureType } from '../types/workout';
import { Button } from './ui/button';

const BLOCK_TYPES: { structure: WorkoutStructureType; label: string; emoji: string }[] = [
  { structure: 'circuit',  label: 'Circuit',  emoji: '🟢' },
  { structure: 'emom',     label: 'EMOM',     emoji: '🔵' },
  { structure: 'amrap',    label: 'AMRAP',    emoji: '🟠' },
  { structure: 'tabata',   label: 'Tabata',   emoji: '🔴' },
  { structure: 'for-time', label: 'For Time', emoji: '🟣' },
  { structure: 'sets',     label: 'Sets',     emoji: '⚫' },
  { structure: 'superset', label: 'Superset', emoji: '🟡' },
  { structure: 'rounds',   label: 'Rounds',   emoji: '🟢' },
  { structure: 'warmup',   label: 'Warm-up',  emoji: '⬜' },
  { structure: 'cooldown', label: 'Cooldown', emoji: '⬜' },
];

export function AddBlockTypePicker({
  onSelect,
  onCancel,
}: {
  onSelect: (structure: WorkoutStructureType) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <p className="text-sm font-medium text-muted-foreground">What type of block?</p>
      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map(({ structure, label, emoji }) => (
          <button
            key={structure}
            type="button"
            onClick={() => onSelect(structure)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-background text-sm hover:bg-muted transition-colors"
          >
            <span aria-hidden>{emoji}</span>
            {label}
          </button>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={onCancel} aria-label="cancel">
        Cancel
      </Button>
    </div>
  );
}
