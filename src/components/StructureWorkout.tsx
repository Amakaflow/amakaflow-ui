import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Watch, Bike, Wand2, ShieldCheck, Save, Code } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { WorkoutStructure, Block, Exercise } from '../types/workout';
import { DeviceId, getDevicesByIds, getDeviceById } from '../lib/devices';
import { BlocksLibrary } from './BlocksLibrary';
import { WorkoutBuilder } from './WorkoutBuilder';
import { BlockDetailEditor } from './BlockDetailEditor';
import { addIdsToWorkout, cloneBlock, generateId } from '../lib/workout-utils';
import { getInitializedSampleWorkout } from '../lib/sample-workout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Label } from './ui/label';
import { CreateBlockDialog } from './CreateBlockDialog';

type Props = {
  workout: WorkoutStructure;
  onWorkoutChange: (workout: WorkoutStructure) => void;
  onAutoMap: () => void;
  onValidate: () => void;
  onSave?: () => void | Promise<void>;
  isEditingFromHistory?: boolean;
  loading: boolean;
  selectedDevice: DeviceId;
  onDeviceChange: (device: DeviceId) => void;
  userSelectedDevices: DeviceId[];
  onNavigateToSettings?: () => void;
};

export function StructureWorkout({
  workout,
  onWorkoutChange,
  onAutoMap,
  onValidate,
  onSave,
  isEditingFromHistory = false,
  loading,
  selectedDevice,
  onDeviceChange,
  userSelectedDevices,
  onNavigateToSettings
}: Props) {
  // Ensure workout has IDs - use a stable check to avoid infinite loops
  const workoutWithIds = useMemo(() => {
    // Guard against undefined/null workout or blocks
    if (!workout || !workout.blocks || !Array.isArray(workout.blocks)) {
      return {
        title: workout?.title || '',
        source: workout?.source || '',
        blocks: []
      };
    }
    
    const hasAllIds = workout.blocks.every(b => 
      b && b.id && b.exercises && Array.isArray(b.exercises) && b.exercises.every(ex => ex && ex.id)
    );
    if (hasAllIds) {
      return workout;
    }
    return addIdsToWorkout(workout);
  }, [
    // Use stable dependencies - only re-compute if structure actually changes
    workout?.blocks?.length || 0,
    workout?.title || '',
    workout?.source || '',
    // Stringify block IDs to detect actual changes (with null checks)
    workout?.blocks?.map(b => b?.id || '').join(',') || '',
    workout?.blocks?.map(b => b?.exercises?.map(e => e?.id || '').join(',') || '').join('|') || ''
  ]);

  // Blocks Library (left panel) - separate from workout blocks
  const [blocksLibrary, setBlocksLibrary] = useState<Block[]>([]);

  // Selected block for editing
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const selectedBlock = (workoutWithIds.blocks || []).find(b => b.id === selectedBlockId) || null;

  // Create block dialog
  const [showCreateBlockDialog, setShowCreateBlockDialog] = useState(false);
  const [editingLibraryBlock, setEditingLibraryBlock] = useState<Block | null>(null);

  // Debug JSON dialog
  const [showDebugJson, setShowDebugJson] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const availableDevices = getDevicesByIds(userSelectedDevices);

  // Initialize blocks library only once on mount if workout is empty
  useEffect(() => {
    if (blocksLibrary.length === 0 && (!workout?.blocks || workout.blocks.length === 0)) {
      const sample = getInitializedSampleWorkout();
      setBlocksLibrary(sample.blocks);
    }
  }, []); // Only run on mount

  // Handle drag end - supports dragging from library to workout and reordering within workout
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Dragging from library to workout
    if (activeId.startsWith('library-')) {
      const blockId = activeId.replace('library-', '');
      const sourceBlock = blocksLibrary.find(b => b.id === blockId);
      if (!sourceBlock) return;

      // Clone the block with new IDs
      const clonedBlock = cloneBlock(sourceBlock);
      
      // Find drop position in workout
      let overIndex = -1;
      if (overId.startsWith('workout-')) {
        overIndex = (workoutWithIds.blocks || []).findIndex(b => b.id === overId.replace('workout-', ''));
      } else if (overId === 'workout-builder') {
        // Dropped on the builder container itself
        overIndex = (workoutWithIds.blocks || []).length;
      }
      
      const newBlocks = [...(workoutWithIds.blocks || [])];
      if (overIndex >= 0) {
        newBlocks.splice(overIndex, 0, clonedBlock);
      } else {
        newBlocks.push(clonedBlock);
      }

      onWorkoutChange({ ...workoutWithIds, blocks: newBlocks });
      return;
    }

    // Reordering blocks within workout
    if (activeId.startsWith('workout-') && overId.startsWith('workout-')) {
      const blocks = workoutWithIds.blocks || [];
      const activeIndex = blocks.findIndex(b => b.id === activeId.replace('workout-', ''));
      const overIndex = blocks.findIndex(b => b.id === overId.replace('workout-', ''));
      
      if (activeIndex >= 0 && overIndex >= 0) {
        const newBlocks = arrayMove(blocks, activeIndex, overIndex);
        onWorkoutChange({ ...workoutWithIds, blocks: newBlocks });
      }
      return;
    }

    // Reordering exercises within a block (handled by BlockDetailEditor's DndContext)
    // This will be handled separately in BlockDetailEditor
  };

  // Block library operations
  const handleLibraryBlockEdit = (block: Block) => {
    setEditingLibraryBlock(block);
    setShowCreateBlockDialog(true);
  };

  const handleLibraryBlockDelete = (blockId: string) => {
    setBlocksLibrary(blocksLibrary.filter(b => b.id !== blockId));
  };

  const handleLibraryBlockCreate = (block: Block) => {
    const newBlock = { ...block, id: generateId(), exercises: block.exercises.map(ex => ({ ...ex, id: generateId() })) };
    if (editingLibraryBlock) {
      setBlocksLibrary(blocksLibrary.map(b => b.id === editingLibraryBlock.id ? newBlock : b));
    } else {
      setBlocksLibrary([...blocksLibrary, newBlock]);
    }
    setShowCreateBlockDialog(false);
    setEditingLibraryBlock(null);
  };

  // Workout block operations
  const handleBlockUpdate = (updatedBlock: Block) => {
    const newBlocks = (workoutWithIds.blocks || []).map(b => 
      b.id === updatedBlock.id ? updatedBlock : b
    );
    onWorkoutChange({ ...workoutWithIds, blocks: newBlocks });
  };

  const handleBlockDelete = (blockId: string) => {
    const newBlocks = (workoutWithIds.blocks || []).filter(b => b.id !== blockId);
    onWorkoutChange({ ...workoutWithIds, blocks: newBlocks });
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  // Exercise operations
  const handleExerciseAdd = (blockId: string, exercise: Exercise) => {
    const newBlocks = (workoutWithIds.blocks || []).map(block => {
      if (block.id === blockId) {
        return { ...block, exercises: [...(block.exercises || []), exercise] };
      }
      return block;
    });
    onWorkoutChange({ ...workoutWithIds, blocks: newBlocks });
  };

  const handleExerciseUpdate = (blockId: string, exerciseId: string, updatedExercise: Exercise) => {
    const newBlocks = (workoutWithIds.blocks || []).map(block => {
      if (block.id === blockId) {
        return {
          ...block,
          exercises: (block.exercises || []).map(ex => ex.id === exerciseId ? updatedExercise : ex)
        };
      }
      return block;
    });
    onWorkoutChange({ ...workoutWithIds, blocks: newBlocks });
  };

  const handleExerciseDelete = (blockId: string, exerciseId: string) => {
    const newBlocks = (workoutWithIds.blocks || []).map(block => {
      if (block.id === blockId) {
        return {
          ...block,
          exercises: (block.exercises || []).filter(ex => ex.id !== exerciseId)
        };
      }
      return block;
    });
    onWorkoutChange({ ...workoutWithIds, blocks: newBlocks });
  };

  const handleExerciseReorder = (blockId: string, exerciseIds: string[]) => {
    const block = (workoutWithIds.blocks || []).find(b => b.id === blockId);
    if (!block || !block.exercises) return;

    const reorderedExercises = exerciseIds
      .map(id => block.exercises.find(ex => ex.id === id))
      .filter((ex): ex is Exercise => ex !== undefined);

    const newBlocks = (workoutWithIds.blocks || []).map(b => 
      b.id === blockId ? { ...b, exercises: reorderedExercises } : b
    );
    onWorkoutChange({ ...workoutWithIds, blocks: newBlocks });
  };

  // Get block IDs for drag-and-drop
  const workoutBlockIds = workoutWithIds.blocks.map(b => `workout-${b.id}`).filter(Boolean);
  const libraryBlockIds = blocksLibrary.map(b => `library-${b.id}`).filter(Boolean);

  // Get workout block IDs (without prefix) for WorkoutBuilder
  const workoutBlockIdsSimple = workoutWithIds.blocks.map(b => b.id || '').filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Header Card with Device Selection and Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Workout Builder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Target Device: {availableDevices.find(d => d.id === selectedDevice)?.name || getDeviceById(selectedDevice)?.name || selectedDevice}</Label>
            <div className="flex gap-2 mt-2">
              {availableDevices.map((device) => (
                <Button
                  key={device.id}
                  variant={selectedDevice === device.id ? 'default' : 'outline'}
                  onClick={() => onDeviceChange(device.id)}
                  className="gap-2"
                >
                  {device.id === 'garmin' && <Watch className="w-4 h-4" />}
                  {device.id === 'apple' && <Watch className="w-4 h-4" />}
                  {device.id === 'zwift' && <Bike className="w-4 h-4" />}
                  {device.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {isEditingFromHistory ? (
              <>
                {onSave && (
                  <Button onClick={onSave} disabled={loading} className="gap-2">
                    <Save className="w-4 h-4" />
                    Save Changes
                  </Button>
                )}
                <Button onClick={onAutoMap} disabled={loading} variant="outline" className="gap-2">
                  <Wand2 className="w-4 h-4" />
                  Re-Auto-Map & Export
                </Button>
                <Button onClick={onValidate} disabled={loading} variant="outline" className="gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Re-Validate & Review
                </Button>
              </>
            ) : (
              <>
                <Button onClick={onAutoMap} disabled={loading} className="gap-2">
                  <Wand2 className="w-4 h-4" />
                  Auto-Map & Export
                </Button>
                <Button onClick={onValidate} disabled={loading} variant="outline" className="gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Validate & Review
                </Button>
              </>
            )}
            {process.env.NODE_ENV === 'development' && (
              <Button onClick={() => setShowDebugJson(true)} variant="outline" className="gap-2">
                <Code className="w-4 h-4" />
                Debug JSON
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Two-Column Layout */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-[30%_70%] gap-4 h-[calc(100vh-300px)]">
          {/* Left Column: Blocks Library */}
          <div className="h-full">
            <SortableContext items={libraryBlockIds} strategy={verticalListSortingStrategy}>
              <BlocksLibrary
                blocks={blocksLibrary}
                onEdit={handleLibraryBlockEdit}
                onDelete={handleLibraryBlockDelete}
                onAddBlock={() => {
                  setEditingLibraryBlock(null);
                  setShowCreateBlockDialog(true);
                }}
              />
            </SortableContext>
          </div>

          {/* Right Column: Workout Structure */}
          <div className="h-full flex flex-col space-y-4">
            <div className="flex-1 min-h-0">
              <WorkoutBuilder
                workout={workoutWithIds}
                selectedBlockId={selectedBlockId}
                onTitleChange={(title) => onWorkoutChange({ ...workoutWithIds, title })}
                onBlockSelect={setSelectedBlockId}
                onBlockDelete={handleBlockDelete}
                blockIds={workoutBlockIdsSimple}
              />
            </div>

            {/* Block Detail Editor */}
            {selectedBlock && (
              <div className="flex-shrink-0 max-h-[400px] overflow-y-auto">
                <BlockDetailEditor
                  block={selectedBlock}
                  workout={workoutWithIds}
                  selectedDevice={selectedDevice}
                  onBlockUpdate={handleBlockUpdate}
                  onExerciseAdd={handleExerciseAdd}
                  onExerciseUpdate={handleExerciseUpdate}
                  onExerciseDelete={handleExerciseDelete}
                  onExerciseReorder={handleExerciseReorder}
                />
              </div>
            )}
          </div>
        </div>
      </DndContext>

      {/* Create Block Dialog */}
      {showCreateBlockDialog && (
        <CreateBlockDialog
          block={editingLibraryBlock}
          onSave={handleLibraryBlockCreate}
          onClose={() => {
            setShowCreateBlockDialog(false);
            setEditingLibraryBlock(null);
          }}
        />
      )}

      {/* Debug JSON Dialog */}
      {showDebugJson && (
        <Dialog open={showDebugJson} onOpenChange={setShowDebugJson}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Workout JSON</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[600px]">
              <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                {JSON.stringify(workoutWithIds, null, 2)}
              </pre>
            </ScrollArea>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(workoutWithIds, null, 2));
                  // You could add a toast here
                }}
              >
                Copy JSON
              </Button>
              <Button onClick={() => setShowDebugJson(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
