import { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Check, GripVertical, X, Plus, ChevronRight, ChevronDown } from 'lucide-react';
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
import { PlatformIcon } from './PlatformIcon';
import {
  PLATFORM_BADGE_COLORS,
  PLATFORM_LABELS,
  type SourcePlatform,
} from './fixtures/multi-source-demo';

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
  sourceIcon,
}: {
  block: SelectedBlock;
  onRemove: () => void;
  sourceIcon?: SourcePlatform;
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
      {sourceIcon && (
        <PlatformIcon platform={sourceIcon} className="w-3.5 h-3.5 shrink-0" />
      )}
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
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());

  const toggleExpand = (e: React.MouseEvent, blockId: string) => {
    e.stopPropagation();
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      next.has(blockId) ? next.delete(blockId) : next.add(blockId);
      return next;
    });
  };

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

  // ── Source platform helpers ──────────────────────────────────────────────

  const getSourcePlatform = (item: ProcessedItem): SourcePlatform | undefined => {
    const icon = item.sourceIcon;
    if (icon === 'instagram' || icon === 'youtube' || icon === 'tiktok') return icon;
    return undefined;
  };

  const uniqueSources = useMemo(() => {
    const sources = new Set<SourcePlatform>();
    doneItems.forEach(item => {
      const p = getSourcePlatform(item);
      if (p) sources.add(p);
    });
    return Array.from(sources);
  }, [doneItems]);

  // ── "Select All from [Source]" ───────────────────────────────────────────

  const selectAllFromSource = (platform: SourcePlatform) => {
    const blocksToAdd: SelectedBlock[] = [];
    doneItems.forEach((item, workoutIndex) => {
      if (getSourcePlatform(item) !== platform) return;
      const blocks: Array<{ id: string; label?: string }> = item.workout?.blocks ?? [];
      blocks.forEach((block, blockIndex) => {
        if (!block.id) return;
        if (selectedBlocks.some(s => s.blockId === block.id)) return;
        blocksToAdd.push({
          workoutIndex,
          blockIndex,
          blockId: block.id,
          blockLabel: block.label ?? `Block ${blockIndex + 1}`,
        });
      });
    });
    if (blocksToAdd.length > 0) {
      onSelectionChange([...selectedBlocks, ...blocksToAdd]);
    }
  };

  // Map blockId -> source platform for the selected blocks panel
  const blockSourceMap = useMemo(() => {
    const map = new Map<string, SourcePlatform>();
    doneItems.forEach(item => {
      const platform = getSourcePlatform(item);
      if (!platform) return;
      const blocks: Array<{ id: string }> = item.workout?.blocks ?? [];
      blocks.forEach(block => {
        if (block.id) map.set(block.id, platform);
      });
    });
    return map;
  }, [doneItems]);

  return (
    <div className="space-y-6" data-testid="block-picker">
      <div>
        <h2 className="text-lg font-semibold">Build your workout</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick blocks from your sources. Drag to reorder on the right.
        </p>
      </div>

      {/* "Select All from [Source]" quick actions */}
      {uniqueSources.length > 1 && (
        <div className="flex flex-wrap gap-2" data-testid="select-all-sources">
          {uniqueSources.map(platform => (
            <Button
              key={platform}
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => selectAllFromSource(platform)}
            >
              <PlatformIcon platform={platform} className="w-3.5 h-3.5" />
              Select all from {PLATFORM_LABELS[platform]}
            </Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: source blocks */}
        <div className="space-y-4">
          {doneItems.map((item, workoutIndex) => {
            const blocks: Array<{ id: string; label?: string; exercises?: unknown[] }> =
              item.workout?.blocks ?? [];
            const sourcePlatform = getSourcePlatform(item);
            return (
              <div key={item.queueId}>
                <div className="flex items-center gap-2 mb-2">
                  {sourcePlatform && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        'gap-1 px-2 py-0.5 text-xs',
                        PLATFORM_BADGE_COLORS[sourcePlatform]
                      )}
                    >
                      <PlatformIcon platform={sourcePlatform} className="w-3 h-3" />
                      {PLATFORM_LABELS[sourcePlatform]}
                    </Badge>
                  )}
                  <p className="text-sm font-medium truncate">{item.workoutTitle}</p>
                </div>
                <div className="space-y-1">
                  {blocks.map((block, blockIndex) => {
                    if (!block.id) return null;
                    const isSelected = selectedBlocks.some(s => s.blockId === block.id);
                    const exerciseCount = block.exercises?.length ?? 0;
                    const isExpanded = expandedBlocks.has(block.id);
                    const exercises = (block.exercises ?? []) as Array<{
                      name: string;
                      sets?: number;
                      reps?: number | string;
                      duration_sec?: number;
                    }>;
                    const platformBorderClass = sourcePlatform
                      ? {
                          instagram: 'border-l-purple-500',
                          youtube: 'border-l-red-500',
                          tiktok: 'border-l-zinc-600 dark:border-l-zinc-400',
                        }[sourcePlatform]
                      : '';
                    return (
                      <div
                        key={block.id}
                        className={cn(
                          'rounded-md border border-l-[3px] text-sm transition-colors',
                          platformBorderClass,
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center gap-2 px-3 py-2">
                          <button
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
                            className="flex items-center gap-2 flex-1 text-left min-w-0"
                          >
                            {isSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <span className={cn('block truncate', isSelected && 'font-medium')}>
                                {block.label ?? `Block ${blockIndex + 1}`}
                              </span>
                              {exerciseCount > 0 && !isExpanded && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {exercises.slice(0, 3).map(e => e.name).join(' · ')}
                                  {exerciseCount > 3 && ` +${exerciseCount - 3} more`}
                                </p>
                              )}
                            </div>
                          </button>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {exerciseCount > 0 ? `${exerciseCount} ex.` : ''}
                          </span>
                          {exerciseCount > 0 && (
                            <button
                              onClick={e => toggleExpand(e, block.id)}
                              className="text-muted-foreground hover:text-foreground shrink-0"
                              aria-label={isExpanded ? 'Collapse exercises' : 'Expand exercises'}
                            >
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className="w-4 h-4" />
                              }
                            </button>
                          )}
                        </div>
                        {isExpanded && (
                          <ul className="pb-2 px-3 space-y-1 pl-8">
                            {exercises.map((ex, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex gap-2">
                                <span className="font-medium text-foreground">{ex.name}</span>
                                {ex.sets && ex.reps && (
                                  <span>{ex.sets}×{ex.reps}</span>
                                )}
                                {ex.duration_sec && !ex.reps && (
                                  <span>{ex.duration_sec}s</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
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
                      sourceIcon={blockSourceMap.get(block.blockId)}
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
