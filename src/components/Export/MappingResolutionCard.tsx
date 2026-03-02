import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Badge } from '../ui/badge';
import type { ValidationResult } from '../../types/workout';

interface MappingResolutionCardProps {
  exercise: ValidationResult;
  onResolve: (original: string, mapped: string) => void;
}

export function MappingResolutionCard({ exercise, onResolve }: MappingResolutionCardProps) {
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState(false);

  const topSuggestion = exercise.suggestions?.[0];

  const handleAccept = (suggestion: string) => {
    onResolve(exercise.original_name, suggestion);
    setResolved(true);
    setOpen(false);
  };

  if (resolved) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm">
        <Check className="w-4 h-4 text-green-500 shrink-0" />
        <span className="flex-1 truncate text-muted-foreground">{exercise.original_name}</span>
        <Badge variant="outline" className="text-xs shrink-0">mapped</Badge>
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
        <span className="flex-1 text-sm truncate">{exercise.original_name}</span>
        {topSuggestion && (
          <span className="text-xs text-muted-foreground truncate max-w-28">
            → {topSuggestion.name}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-3 py-2 border-t space-y-1">
          {exercise.suggestions?.slice(0, 4).map(s => (
            <button
              key={s.name}
              onClick={() => handleAccept(s.name)}
              className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm text-left"
            >
              <span>{s.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {Math.round(s.confidence * 100)}%
              </span>
            </button>
          ))}
          {(!exercise.suggestions || exercise.suggestions.length === 0) && (
            <p className="text-xs text-muted-foreground py-1">No suggestions available</p>
          )}
        </div>
      )}
    </div>
  );
}
