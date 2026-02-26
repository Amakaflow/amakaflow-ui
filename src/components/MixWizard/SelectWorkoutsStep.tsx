import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import { UnifiedWorkout } from '../../types/unified-workout';
import { cn } from '../ui/utils';

interface SelectWorkoutsStepProps {
  workouts: UnifiedWorkout[];
  selected: string[];
  onToggle: (id: string) => void;
}

export function SelectWorkoutsStep({ workouts, selected, onToggle }: SelectWorkoutsStepProps) {
  const [search, setSearch] = useState('');
  const filtered = workouts.filter(w => w.title?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Select Workouts</h3>
        <p className="text-sm text-muted-foreground">Choose the workouts you want to mix blocks from.</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search workouts..."
          aria-label="Search workouts"
          className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
        />
      </div>
      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {filtered.map(workout => {
          const isSelected = selected.includes(workout.id);
          return (
            <button
              key={workout.id}
              onClick={() => onToggle(workout.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                isSelected ? 'border-primary/50 bg-primary/5' : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
              )}
            >
              <div className={cn('w-5 h-5 rounded border flex items-center justify-center flex-shrink-0', isSelected ? 'bg-primary border-primary' : 'border-white/30')}>
                {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
              <span className="flex-1 text-sm font-medium truncate">{workout.title}</span>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No workouts found</p>}
      </div>
    </div>
  );
}
