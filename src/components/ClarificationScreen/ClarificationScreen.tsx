import { useState, useRef, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../ui/button';
import type { PipelinePreview } from '../../types/pipeline';
import { ClarificationCard } from './ClarificationCard';

interface ClarificationScreenProps {
  preview: PipelinePreview;
  onConfirm: (selections: Record<string, string>) => void;
  onBack: () => void;
}

export function ClarificationScreen({ preview, onConfirm, onBack }: ClarificationScreenProps) {
  const ambiguousBlocks = useMemo(() => {
    const blocks = preview.ambiguous_blocks ?? [];
    return blocks.filter((block) => {
      if (block.structure_options.length === 0) {
        console.warn(
          `[ClarificationScreen] Block "${block.id}" has no structure_options — skipping.`,
        );
        return false;
      }
      return block.structure_confidence < 0.8;
    });
  }, [preview.ambiguous_blocks]);

  // Build initial selections from each block's structure field
  const buildInitialSelections = (): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const block of ambiguousBlocks) {
      result[block.id] = block.structure ?? '';
    }
    return result;
  };

  const initialSelectionsRef = useRef<Record<string, string>>(buildInitialSelections());
  const [selections, setSelections] = useState<Record<string, string>>(
    buildInitialSelections,
  );
  const [showBackWarning, setShowBackWarning] = useState(false);

  const handleSelect = (blockId: string, value: string) => {
    setSelections((prev) => ({ ...prev, [blockId]: value }));
  };

  const hasChanges = () => {
    const initial = initialSelectionsRef.current;
    return Object.keys(selections).some((id) => selections[id] !== initial[id]);
  };

  const handleBack = () => {
    if (hasChanges()) {
      setShowBackWarning(true);
    } else {
      onBack();
    }
  };

  const n = ambiguousBlocks.length;
  const blockWord = n === 1 ? 'block' : 'blocks';
  const verbWord = n === 1 ? 'is' : 'are';

  return (
    <div data-testid="clarification-screen" className="max-w-2xl mx-auto space-y-4">
      {/* Top navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {/* Back warning */}
      {showBackWarning && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm flex items-center justify-between gap-4">
          <span className="text-destructive font-medium">You'll lose your changes.</span>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="underline text-destructive hover:text-destructive/80 text-sm"
            >
              Go back
            </button>
            <button
              type="button"
              onClick={() => setShowBackWarning(false)}
              className="underline text-muted-foreground hover:text-foreground text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">We need your help with this workout</h1>
        <p className="text-sm text-muted-foreground mt-1">
          We're not sure how {n} {blockWord} {verbWord} structured. Review the suggestions and
          correct any that look wrong.
        </p>
      </div>

      {/* Cards */}
      <div className="space-y-4 pb-20">
        {ambiguousBlocks.map((block, i) => (
          <ClarificationCard
            key={block.id}
            block={block}
            index={i + 1}
            total={n}
            selected={selections[block.id] ?? ''}
            aiGuess={block.structure ?? ''}
            onSelect={(value) => handleSelect(block.id, value)}
          />
        ))}
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 sm:fixed sm:bottom-0 sm:left-0 sm:right-0 bg-background border-t py-3 px-4 flex justify-between items-center">
        <Button variant="ghost" onClick={() => onConfirm(selections)}>
          Skip — use best guesses
        </Button>
        <Button onClick={() => onConfirm(selections)}>Save to Library</Button>
      </div>
    </div>
  );
}
