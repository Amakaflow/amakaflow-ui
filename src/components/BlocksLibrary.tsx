import { Block } from '../types/workout';
import { GripVertical, Edit2, Trash2, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { getStructureDisplayName } from '../lib/workout-utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface BlocksLibraryProps {
  blocks: Block[];
  onEdit: (block: Block) => void;
  onDelete: (blockId: string) => void;
  onAddBlock: () => void;
}

function LibraryBlockCard({ block, onEdit, onDelete }: { block: Block; onEdit: () => void; onDelete: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: `library-${block.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const structureName = getStructureDisplayName(block.structure);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 border rounded-lg bg-card hover:bg-muted/50"
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{block.label}</span>
          <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full whitespace-nowrap">
            {structureName}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {block.exercises.length} exercise{block.exercises.length !== 1 ? 's' : ''}
        </p>
      </div>
      
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={onEdit}
          className="h-8 w-8 p-0"
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function BlocksLibrary({ blocks, onEdit, onDelete, onAddBlock }: BlocksLibraryProps) {
  return (
    <div className="h-full flex flex-col border rounded-lg bg-muted/20">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Blocks Library</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAddBlock}
          className="w-full gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Block
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No blocks in library. Click "Add Block" to create one.
            </p>
          ) : (
            blocks.map((block) => (
              <LibraryBlockCard
                key={block.id}
                block={block}
                onEdit={() => onEdit(block)}
                onDelete={() => block.id && onDelete(block.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}





