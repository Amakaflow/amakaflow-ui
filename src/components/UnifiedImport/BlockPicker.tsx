import { Button } from '../ui/button';
import { Check } from 'lucide-react';
import { cn } from '../ui/utils';
import type { ProcessedItem, QueueItem, SelectedBlock } from '../../types/unified-import';

interface BlockPickerProps {
  queueItems: QueueItem[];
  processedItems: ProcessedItem[];
  selectedBlocks: SelectedBlock[];
  onSelectionChange: (blocks: SelectedBlock[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BlockPicker({
  queueItems: _queueItems,
  processedItems,
  selectedBlocks,
  onSelectionChange,
  onConfirm,
  onCancel,
}: BlockPickerProps) {
  const toggle = (block: SelectedBlock) => {
    const exists = selectedBlocks.some(s => s.blockId === block.blockId);
    if (exists) {
      onSelectionChange(selectedBlocks.filter(s => s.blockId !== block.blockId));
    } else {
      onSelectionChange([...selectedBlocks, block]);
    }
  };

  const doneItems = processedItems.filter(p => p.status === 'done');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Choose blocks</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tap blocks to select them. Your selection appears on the right.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: source blocks */}
        <div className="space-y-4">
          {doneItems.map((item, workoutIndex) => {
            const blocks: Array<{ id: string; label: string; exercises?: unknown[] }> = item.workout?.blocks ?? [];
            return (
              <div key={item.queueId}>
                <p className="text-sm font-medium mb-2">{item.workoutTitle}</p>
                <div className="space-y-1">
                  {blocks.map((block, blockIndex) => {
                    const isSelected = selectedBlocks.some(s => s.blockId === block.id);
                    const exerciseCount = block.exercises?.length ?? 0;
                    return (
                      <button
                        key={block.id}
                        onClick={() =>
                          toggle({
                            workoutIndex,
                            blockIndex,
                            blockId: block.id,
                            blockLabel: block.label ?? `Block ${blockIndex + 1}`,
                          })
                        }
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-md border text-sm flex items-center gap-2 transition-colors',
                          isSelected
                            ? 'border-primary bg-primary/10 font-medium'
                            : 'border-border hover:bg-muted/50'
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
                        <span className="flex-1">{block.label ?? `Block ${blockIndex + 1}`}</span>
                        {exerciseCount > 0 && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: selected preview */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Selected ({selectedBlocks.length})
          </p>
          {selectedBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No blocks selected yet</p>
          ) : (
            selectedBlocks.map((s, idx) => (
              <div
                key={s.blockId}
                className="px-3 py-2 rounded-md border bg-muted/30 text-sm flex items-center gap-2"
              >
                <span className="text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                <span>{s.blockLabel}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={selectedBlocks.length === 0}
          className="flex-1"
        >
          Edit this workout ({selectedBlocks.length} blocks)
        </Button>
      </div>
    </div>
  );
}
