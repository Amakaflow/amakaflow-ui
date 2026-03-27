import { useState } from 'react';
import { Block, Exercise, WorkoutStructureType, RestType } from '../types/workout';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Edit2, Trash2, Plus, GripVertical, Video, ExternalLink, Save, RotateCcw, ChevronDown, Layers, Timer, Repeat, Zap, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { FollowAlongInstructions } from './FollowAlongInstructions';
import { ExerciseSearch } from './ExerciseSearch';
import { getStructureDisplayName, getStructureDefaults, generateId } from '../lib/workout-utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DndContext, closestCenter, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface BlockDetailEditorProps {
  block: Block | null;
  workout: { blocks: Block[] };
  selectedDevice: string;
  onBlockUpdate: (block: Block) => void;
  onExerciseAdd: (blockId: string, exercise: Exercise) => void;
  onExerciseUpdate: (blockId: string, exerciseId: string, exercise: Exercise) => void;
  onExerciseDelete: (blockId: string, exerciseId: string) => void;
  onExerciseReorder: (blockId: string, exerciseIds: string[]) => void;
}

function SortableExerciseCard({ 
  exercise, 
  onEdit, 
  onDelete 
}: { 
  exercise: Exercise; 
  onEdit: () => void; 
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: exercise.id || '' });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getDisplayName = () => {
    // Show count in the name for easier scanning
    const parts: string[] = [];
    if (exercise.reps) {
      parts.push(`${exercise.reps}`);
    } else if (exercise.calories) {
      parts.push(`${exercise.calories} cal`);
    } else if (exercise.distance_m) {
      parts.push(`${exercise.distance_m}m`);
    } else if (exercise.duration_sec) {
      parts.push(`${exercise.duration_sec}s`);
    }
    if (parts.length > 0) {
      return `${parts.join(' ')} ${exercise.name}`;
    }
    return exercise.name;
  };

  const getDisplayText = () => {
    const parts: string[] = [];
    if (exercise.sets) parts.push(`${exercise.sets} sets`);
    if (exercise.reps_range) parts.push(`${exercise.reps_range} reps`);
    if (exercise.rest_sec) parts.push(`Rest: ${exercise.rest_sec}s`);
    return parts.length > 0 ? parts.join(' • ') : null;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50 hover:bg-muted"
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{getDisplayName()}</p>
          {exercise.followAlongUrl && (
            <a
              href={exercise.followAlongUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:text-primary/80"
              title="View follow-along video"
            >
              <Video className="w-4 h-4" />
            </a>
          )}
        </div>
        {getDisplayText() && (
          <p className="text-sm text-muted-foreground">
            {getDisplayText()}
          </p>
        )}
      </div>
      
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

export function BlockDetailEditor({
  block,
  workout,
  selectedDevice,
  onBlockUpdate,
  onExerciseAdd,
  onExerciseUpdate,
  onExerciseDelete,
  onExerciseReorder
}: BlockDetailEditorProps) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [tempLabel, setTempLabel] = useState(block?.label || '');
  const [editingExercise, setEditingExercise] = useState<{ exercise: Exercise; originalExercise: Exercise } | null>(null);
  const [editedExerciseData, setEditedExerciseData] = useState<Exercise | null>(null);
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleExerciseDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !block || active.id === over.id) return;

    const activeIndex = block.exercises.findIndex(ex => ex.id === active.id);
    const overIndex = block.exercises.findIndex(ex => ex.id === over.id);

    if (activeIndex >= 0 && overIndex >= 0) {
      const reorderedExercises = arrayMove(block.exercises, activeIndex, overIndex);
      const exerciseIds = reorderedExercises.map(ex => ex.id || '').filter(Boolean);
      onExerciseReorder(block.id || '', exerciseIds);
    }
  };

  if (!block) {
    return (
      <div className="p-4 border rounded-lg bg-muted/20">
        <p className="text-sm text-muted-foreground text-center py-8">
          Select a block to edit
        </p>
      </div>
    );
  }

  const handleLabelSave = () => {
    onBlockUpdate({ ...block, label: tempLabel });
    setEditingLabel(false);
  };

  const handleStructureChange = (newStructure: WorkoutStructureType | null) => {
    const defaults = getStructureDefaults(newStructure);
    const updatedBlock: Block = {
      ...block,
      structure: newStructure,
      ...defaults,
    };
    onBlockUpdate(updatedBlock);
  };

  const handleEditExercise = (exercise: Exercise) => {
    setEditingExercise({ exercise, originalExercise: { ...exercise } });
    setEditedExerciseData({ ...exercise });
  };

  const handleSaveExercise = () => {
    if (!editedExerciseData || !editingExercise) return;
    onExerciseUpdate(block.id || '', editingExercise.exercise.id || '', editedExerciseData);
    setEditingExercise(null);
    setEditedExerciseData(null);
  };

  const handleRevertExercise = () => {
    if (!editingExercise) return;
    setEditedExerciseData({ ...editingExercise.originalExercise });
  };

  const handleCancelEdit = () => {
    setEditingExercise(null);
    setEditedExerciseData(null);
  };

  const handleAddExercise = (exerciseName: string) => {
    const newExercise: Exercise = {
      id: generateId(),
      name: exerciseName,
      sets: null,
      reps: null,
      reps_range: null,
      duration_sec: null,
      rest_sec: null,
      distance_m: null,
      distance_range: null,
      type: 'strength',
      notes: null,
    };
    onExerciseAdd(block.id || '', newExercise);
    setShowExerciseSearch(false);
  };

  const structureName = getStructureDisplayName(block.structure);

  return (
    <div className="p-4 border rounded-lg bg-card space-y-4">
      {/* Block Label */}
      <div className="flex items-center gap-2">
        {editingLabel ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={tempLabel}
              onChange={(e) => setTempLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLabelSave();
                if (e.key === 'Escape') {
                  setTempLabel(block.label);
                  setEditingLabel(false);
                }
              }}
              className="flex-1"
              autoFocus
            />
            <Button size="sm" onClick={handleLabelSave}>
              <Save className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => {
              setTempLabel(block.label);
              setEditingLabel(false);
            }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <>
            <h4 className="font-semibold">{block.label}</h4>
            <Button size="sm" variant="ghost" onClick={() => setEditingLabel(true)}>
              <Edit2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {/* Structure Type */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Current: {structureName}</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                Change Workout Structure
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Workout Structure Types</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleStructureChange(null)}>
                Single
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStructureChange('superset')}>
                <Layers className="w-4 h-4 mr-2" />
                Superset
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStructureChange('circuit')}>
                <Repeat className="w-4 h-4 mr-2" />
                Circuit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStructureChange('tabata')}>
                <Timer className="w-4 h-4 mr-2" />
                Tabata
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStructureChange('emom')}>
                <Repeat className="w-4 h-4 mr-2" />
                EMOM
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStructureChange('amrap')}>
                <Timer className="w-4 h-4 mr-2" />
                AMRAP
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStructureChange('for-time')}>
                <Zap className="w-4 h-4 mr-2" />
                For Time
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStructureChange('rounds')}>
                <Repeat className="w-4 h-4 mr-2" />
                Rounds
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStructureChange('sets')}>
                <Layers className="w-4 h-4 mr-2" />
                Sets
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStructureChange('regular')}>
                Regular
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Structure-specific fields */}
        {block.structure === 'tabata' && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Work (sec)</Label>
              <Input
                type="number"
                value={block.time_work_sec || ''}
                onChange={(e) => onBlockUpdate({ ...block, time_work_sec: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
            <div>
              <Label>Rest (sec)</Label>
              <Input
                type="number"
                value={block.time_rest_sec || ''}
                onChange={(e) => onBlockUpdate({ ...block, time_rest_sec: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
            <div>
              <Label>Rounds</Label>
              <Input
                type="number"
                value={block.rounds || ''}
                onChange={(e) => onBlockUpdate({ ...block, rounds: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
          </div>
        )}

        {block.structure === 'emom' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Work (sec)</Label>
              <Input
                type="number"
                value={block.time_work_sec || ''}
                onChange={(e) => onBlockUpdate({ ...block, time_work_sec: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
            <div>
              <Label>Minutes</Label>
              <Input
                type="number"
                value={block.rounds || ''}
                onChange={(e) => onBlockUpdate({ ...block, rounds: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
          </div>
        )}

        {(block.structure === 'amrap' || block.structure === 'for-time') && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Time Cap (sec)</Label>
              <Input
                type="number"
                value={block.time_cap_sec || ''}
                onChange={(e) => onBlockUpdate({ ...block, time_cap_sec: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
            {block.structure === 'for-time' && (
              <div>
                <Label>Rounds</Label>
                <Input
                  type="number"
                  value={block.rounds || ''}
                  onChange={(e) => onBlockUpdate({ ...block, rounds: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
            )}
          </div>
        )}

        {/* Rest Type for regular/single blocks - show standalone selector */}
        {(!block.structure || block.structure === 'regular') && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Default Rest Type</Label>
              <Select
                value={block.rest_type || 'timed'}
                onValueChange={(value: RestType) => onBlockUpdate({ ...block, rest_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timed">Timed (countdown)</SelectItem>
                  <SelectItem value="button">Lap Button</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Applied to exercises without individual rest type
              </p>
            </div>
          </div>
        )}

        {(block.structure === 'superset' || block.structure === 'circuit' || block.structure === 'rounds') && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Rounds</Label>
              <Input
                type="number"
                value={block.rounds || ''}
                onChange={(e) => onBlockUpdate({ ...block, rounds: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
            <div>
              <Label>Rest Between (sec)</Label>
              <Input
                type="number"
                value={block.rest_between_rounds_sec || ''}
                onChange={(e) => onBlockUpdate({ ...block, rest_between_rounds_sec: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
            <div>
              <Label>Rest Type</Label>
              <Select
                value={block.rest_type || 'timed'}
                onValueChange={(value: RestType) => onBlockUpdate({ ...block, rest_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timed">Timed (countdown)</SelectItem>
                  <SelectItem value="button">Lap Button</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {block.structure === 'sets' && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Sets</Label>
              <Input
                type="number"
                value={block.sets || ''}
                onChange={(e) => onBlockUpdate({ ...block, sets: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
            <div>
              <Label>Rest Between (sec)</Label>
              <Input
                type="number"
                value={block.rest_between_sets_sec || ''}
                onChange={(e) => onBlockUpdate({ ...block, rest_between_sets_sec: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
            <div>
              <Label>Rest Type</Label>
              <Select
                value={block.rest_type || 'timed'}
                onValueChange={(value: RestType) => onBlockUpdate({ ...block, rest_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timed">Timed</SelectItem>
                  <SelectItem value="button">Lap Button</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Exercises List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Exercises</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExerciseSearch(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Exercise
          </Button>
        </div>
        
        <ScrollArea className="h-[300px]">
          <div className="space-y-2 pr-4">
            {block.exercises.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No exercises. Click "Add Exercise" to add one.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleExerciseDragEnd}
              >
                <SortableContext 
                  items={block.exercises.map(ex => ex.id || '').filter(Boolean)}
                  strategy={verticalListSortingStrategy}
                >
                  {block.exercises.map((exercise) => (
                    <SortableExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      onEdit={() => handleEditExercise(exercise)}
                      onDelete={() => exercise.id && onExerciseDelete(block.id || '', exercise.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Exercise Search Modal */}
      {showExerciseSearch && (
        <ExerciseSearch
          onSelect={handleAddExercise}
          onClose={() => setShowExerciseSearch(false)}
          device={selectedDevice}
        />
      )}

      {/* Exercise Edit Dialog */}
      <Dialog open={editingExercise !== null} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Exercise</DialogTitle>
          </DialogHeader>
          {editedExerciseData && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="exercise-name">Exercise Name</Label>
                <Input
                  id="exercise-name"
                  value={editedExerciseData.name}
                  onChange={(e) => setEditedExerciseData({ ...editedExerciseData, name: e.target.value })}
                  placeholder="Exercise name"
                  className="mt-1"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="exercise-sets">Sets</Label>
                    <Input
                      id="exercise-sets"
                      value={editedExerciseData.sets || ''}
                      onChange={(e) => setEditedExerciseData({ ...editedExerciseData, sets: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Sets"
                      type="number"
                      className="mt-1"
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="exercise-rest">Rest (sec)</Label>
                    <Input
                      id="exercise-rest"
                      value={editedExerciseData.rest_sec || ''}
                      onChange={(e) => setEditedExerciseData({ ...editedExerciseData, rest_sec: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Rest (sec)"
                      type="number"
                      className="mt-1"
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="exercise-rest-type">Rest Type</Label>
                    <Select
                      value={editedExerciseData.rest_type || 'timed'}
                      onValueChange={(value: RestType) => setEditedExerciseData({ ...editedExerciseData, rest_type: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="timed">Timed</SelectItem>
                        <SelectItem value="button">Lap Button</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label htmlFor="exercise-reps">Reps</Label>
                    <Input
                      id="exercise-reps"
                      value={editedExerciseData.reps || ''}
                      onChange={(e) => {
                        const reps = e.target.value ? parseInt(e.target.value) : null;
                        setEditedExerciseData({ 
                          ...editedExerciseData, 
                          reps,
                          distance_m: reps ? null : editedExerciseData.distance_m
                        });
                      }}
                      placeholder="Reps"
                      type="number"
                      className="mt-1"
                    />
                  </div>
                  <div className="text-muted-foreground text-sm px-2 pb-2">or</div>
                  <div className="flex-1">
                    <Label htmlFor="exercise-distance">Distance (m)</Label>
                    <Input
                      id="exercise-distance"
                      value={editedExerciseData.distance_m || ''}
                      onChange={(e) => {
                        const distance_m = e.target.value ? parseInt(e.target.value) : null;
                        setEditedExerciseData({ 
                          ...editedExerciseData, 
                          distance_m,
                          reps: distance_m ? null : editedExerciseData.reps
                        });
                      }}
                      placeholder="Distance (m)"
                      type="number"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Follow-Along Video URL
                  </Label>
                  <FollowAlongInstructions />
                </div>
                <Input
                  value={editedExerciseData.followAlongUrl || ''}
                  onChange={(e) => setEditedExerciseData({ ...editedExerciseData, followAlongUrl: e.target.value || null })}
                  placeholder="Instagram, TikTok, YouTube, or any video URL"
                  type="url"
                />
                {editedExerciseData.followAlongUrl && (
                  <a
                    href={editedExerciseData.followAlongUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Open link <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleRevertExercise}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Revert
            </Button>
            <Button onClick={handleSaveExercise}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

