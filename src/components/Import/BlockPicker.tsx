import { Button } from '../ui/button';
import { Check, GripVertical, X, Plus } from 'lucide-react';
import { cn } from '../ui/utils';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ProcessedItem, QueueItem, SelectedBlock } from '../../types/import';

interface BlockPickerProps {
  queueItems: QueueItem[];
  processedItems: ProcessedItem[];
  selectedBlocks: SelectedBlock[];
  onSelectionChange: (blocks: SelectedBlock[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function SortableSelectedBlock({
  block,
  onRemove,
}: {
  block: SelectedBlock;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.blockId });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30 text-sm',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="flex-1">{block.blockLabel}</span>
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive shrink-0"
        aria-label="Remove block"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
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

  const remove = (blockId: string) => {
    onSelectionChange(selectedBlocks.filter(s => s.blockId !== blockId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = selectedBlocks.findIndex(b => b.blockId === active.id);
    const newIdx = selectedBlocks.findIndex(b => b.blockId === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    onSelectionChange(arrayMove(selectedBlocks, oldIdx, newIdx));
  };

  const addCustomBlock = () => {
    const id = crypto.randomUUID();
    onSelectionChange([
      ...selectedBlocks,
      { workoutIndex: -1, blockIndex: -1, blockId: id, blockLabel: 'Custom block' },
    ]);
  };

  const doneItems = processedItems.filter(p => p.status === 'done');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Build your workout</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick blocks from your sources. Drag to reorder on the right.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: source blocks */}
        <div className="space-y-4">
          {doneItems.map((item, workoutIndex) => {
            const blocks: Array<{ id: string; label?: string; exercises?: unknown[] }> =
              item.workout?.blocks ?? [];
            return (
              <div key={item.queueId}>
                <p className="text-sm font-medium mb-2 truncate">{item.workoutTitle}</p>
                <div className="space-y-1">
                  {blocks.map((block, blockIndex) => {
                    if (!block.id) return null;
                    const isSelected = selectedBlocks.some(s => s.blockId === block.id);
                    const exerciseCount = block.exercises?.length ?? 0;
                    return (
                      <button
                        key={block.id}
                        role="checkbox"
                        aria-checked={isSelected}
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
                        <span className="flex-1 truncate">{block.label ?? `Block ${blockIndex + 1}`}</span>
                        {exerciseCount > 0 && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {exerciseCount} ex.
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

        {/* Right: selected + reorderable */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Your workout ({selectedBlocks.length} block{selectedBlocks.length !== 1 ? 's' : ''})
          </p>

          {selectedBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Select blocks on the left to build your workout
            </p>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={selectedBlocks.map(b => b.blockId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {selectedBlocks.map(block => (
                    <SortableSelectedBlock
                      key={block.blockId}
                      block={block}
                      onRemove={() => remove(block.blockId)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground w-full justify-start mt-2"
            onClick={addCustomBlock}
          >
            <Plus className="w-4 h-4" />
            Add your own block
          </Button>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Back
        </Button>
        <Button
          onClick={onConfirm}
          disabled={selectedBlocks.length === 0}
          className="flex-1"
        >
          Save workout ({selectedBlocks.length} block{selectedBlocks.length !== 1 ? 's' : ''})
        </Button>
      </div>
    </div>
  );
}
