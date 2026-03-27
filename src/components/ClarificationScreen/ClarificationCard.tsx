import type { PipelineAmbiguousBlock } from '../../types/pipeline';
import { StructureOption } from './StructureOption';

interface ClarificationCardProps {
  block: PipelineAmbiguousBlock;
  index: number;
  total: number;
  selected: string;
  aiGuess: string;
  onSelect: (value: string) => void;
}

export function ClarificationCard({
  block,
  index,
  total,
  selected,
  aiGuess,
  onSelect,
}: ClarificationCardProps) {
  const MAX_EXERCISES = 6;
  const exerciseNames = block.exercises.map((e) => e.name);
  const displayNames =
    exerciseNames.length > MAX_EXERCISES
      ? exerciseNames.slice(0, MAX_EXERCISES).join(', ') + ` + ${exerciseNames.length - MAX_EXERCISES} more`
      : exerciseNames.join(', ');

  return (
    <div
      data-testid="clarification-card"
      className="rounded-lg border bg-card p-4 shadow-sm space-y-3"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{block.label ?? 'Block'}</span>
        <span className="text-xs text-muted-foreground">
          [{index} of {total}]
        </span>
      </div>

      {/* Exercise list */}
      {exerciseNames.length > 0 && (
        <p className="text-xs text-muted-foreground">{displayNames}</p>
      )}

      {/* Subheading */}
      <p className="text-sm font-medium">How is this block structured?</p>

      {/* Structure options */}
      <div
        className="space-y-2"
        role="radiogroup"
        aria-label="Block structure"
      >
        {block.structure_options.map((option) => (
          <StructureOption
            key={option}
            value={option}
            isSelected={selected === option}
            isAiGuess={option === aiGuess}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
