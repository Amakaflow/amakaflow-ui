import { cn } from '../ui/utils';
import { getStructureLabel } from '../../utils/structureLabels';

interface StructureOptionProps {
  value: string;
  isSelected: boolean;
  isAiGuess: boolean;
  onSelect: (value: string) => void;
}

export function StructureOption({ value, isSelected, isAiGuess, onSelect }: StructureOptionProps) {
  const { label, description } = getStructureLabel(value);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      data-testid={`structure-option-${value}`}
      onClick={() => onSelect(value)}
      className={cn(
        'w-full text-left rounded-md border p-3 transition-colors',
        isSelected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-border bg-background hover:bg-accent/50',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Radio dot */}
        <div
          className={cn(
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
            isSelected ? 'border-blue-500' : 'border-muted-foreground',
          )}
        >
          {isSelected && (
            <div className="h-2 w-2 rounded-full bg-blue-500" />
          )}
        </div>

        {/* Label + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{label}</span>
            {isAiGuess && (
              <span
                className={cn(
                  'border border-dashed border-muted-foreground text-muted-foreground text-xs px-1.5 py-0.5 rounded',
                  !isSelected && 'opacity-40',
                )}
              >
                AI guess
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
    </button>
  );
}
