import { Block, WorkoutStructure } from '../types/workout';
import { BlockSummaryCard } from './BlockSummaryCard';
import { ScrollArea } from './ui/scroll-area';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Input } from './ui/input';

interface WorkoutBuilderProps {
  workout: WorkoutStructure;
  selectedBlockId: string | null;
  onTitleChange: (title: string) => void;
  onBlockSelect: (blockId: string) => void;
  onBlockDelete: (blockId: string) => void;
  blockIds: string[];
}

export function WorkoutBuilder({
  workout,
  selectedBlockId,
  onTitleChange,
  onBlockSelect,
  onBlockDelete,
  blockIds
}: WorkoutBuilderProps) {
  return (
    <div className="h-full flex flex-col border rounded-lg">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold mb-3">Workout Structure</h3>
        <Input
          value={workout.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Workout Title"
          className="w-full"
        />
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4">
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {!workout.blocks || workout.blocks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Drag blocks from the library to build your workout
                </p>
              ) : (
                workout.blocks.map((block) => (
                  <BlockSummaryCard
                    key={block.id}
                    block={block}
                    onSelect={() => block.id && onBlockSelect(block.id)}
                    onDelete={() => block.id && onBlockDelete(block.id)}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </div>
      </ScrollArea>
    </div>
  );
}


