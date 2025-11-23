import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Watch, Bike, Wand2, ShieldCheck, Edit2, Check, X, Trash2, GripVertical, Plus, Layers, Move, ChevronDown, ChevronUp, Minimize2, Maximize2, Save, Code } from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { WorkoutStructure, Exercise, Block } from '../types/workout';
import { DeviceId, getDevicesByIds, getDeviceById } from '../lib/devices';
import { ExerciseSearch } from './ExerciseSearch';
import { Badge } from './ui/badge';
import { addIdsToWorkout, generateId, getStructureDisplayName } from '../lib/workout-utils';

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

// Drag and Drop Types
const ItemTypes = {
  EXERCISE: 'exercise',
  BLOCK: 'block',
};

interface DraggableExerciseData {
  blockIdx: number;
  exerciseIdx: number;
  exercise: Exercise;
  supersetIdx?: number; // Optional: if exercise is in a superset
}

interface DraggableBlockData {
  blockIdx: number;
  block: Block;
}

// Draggable Exercise Component
function DraggableExercise({
  exercise,
  blockIdx,
  exerciseIdx,
  supersetIdx,
  onEdit,
  onDelete,
}: {
  exercise: Exercise;
  blockIdx: number;
  exerciseIdx: number;
  supersetIdx?: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.EXERCISE,
    item: { blockIdx, exerciseIdx, exercise, supersetIdx } as DraggableExerciseData,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const getDisplayName = () => {
    // Show count in the name for easier scanning, but only if not already included
    const name = exercise.name || '';
    
    // Check if name already starts with the rep count/distance/duration
    if (exercise.reps) {
      const repsStr = String(exercise.reps);
      // Check if name already starts with the rep count (with or without space)
      if (name.startsWith(repsStr + ' ') || name.startsWith(repsStr + '\t')) {
        return name; // Already includes rep count
      }
      return `${repsStr} ${name}`;
    } else if (exercise.distance_m) {
      const distanceStr = `${exercise.distance_m}m`;
      // Check if name already starts with the distance (case-insensitive)
      if (name.toLowerCase().startsWith(distanceStr.toLowerCase() + ' ') || 
          name.toLowerCase().startsWith(distanceStr.toLowerCase() + '\t')) {
        return name; // Already includes distance
      }
      return `${distanceStr} ${name}`;
    } else if (exercise.duration_sec) {
      const durationStr = `${exercise.duration_sec}s`;
      // Check if name already starts with the duration
      if (name.startsWith(durationStr + ' ') || name.startsWith(durationStr + '\t')) {
        return name; // Already includes duration
      }
      return `${durationStr} ${name}`;
    }
    return name;
  };

  const getDisplayText = () => {
    const parts: string[] = [];
    if (exercise.sets) parts.push(`${exercise.sets} sets`);
    if (exercise.reps_range) parts.push(`${exercise.reps_range} reps`);
    if (exercise.rest_sec) parts.push(`Rest: ${exercise.rest_sec}s`);
    if (exercise.distance_range) parts.push(`${exercise.distance_range}`);
    return parts.length > 0 ? parts.join(' • ') : null;
  };

  return (
    <div
      ref={drag}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50 hover:bg-muted cursor-move"
    >
      <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
        <GripVertical className="w-4 h-4" />
      </div>
      
      <div className="flex-1">
        <p className="font-medium">{getDisplayName()}</p>
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

// Droppable Exercise Container (Block-level exercises or Superset exercises)
function ExerciseDropZone({
  blockIdx,
  exercises,
  onDrop,
  onEdit,
  onDelete,
  label,
  supersetIdx,
}: {
  blockIdx: number;
  exercises: Exercise[];
  onDrop: (item: DraggableExerciseData, targetIdx: number, targetSupersetIdx?: number) => void;
  onEdit: (exerciseIdx: number) => void;
  onDelete: (exerciseIdx: number) => void;
  label?: string;
  supersetIdx?: number;
}) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.EXERCISE,
    drop: (item: DraggableExerciseData) => {
      // Pass supersetIdx if this is a superset drop zone
      onDrop(item, exercises.length, supersetIdx);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={drop}
      className={`space-y-2 min-h-[50px] p-2 rounded-lg border-2 border-dashed transition-colors ${
        isOver ? 'border-primary bg-primary/10' : 'border-transparent'
      }`}
    >
      {label && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Layers className="w-4 h-4" />
          <span>{label}</span>
        </div>
      )}
      {exercises.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-4">
          Drop exercise here or click Add Exercise
        </div>
      )}
      {exercises.map((exercise, idx) => (
        <DraggableExercise
          key={exercise.id || idx}
          exercise={exercise}
          blockIdx={blockIdx}
          exerciseIdx={idx}
          supersetIdx={supersetIdx}
          onEdit={() => onEdit(idx)}
          onDelete={() => onDelete(idx)}
        />
      ))}
    </div>
  );
}

// Draggable Block Component
function DraggableBlock({
  block,
  blockIdx,
  onBlockDrop,
  onExerciseDrop,
  onEditExercise,
  onDeleteExercise,
  onAddExercise,
  onAddExerciseToSuperset,
  onAddSuperset,
  onDeleteSuperset,
  onUpdateBlock,
  collapseSignal,
}: {
  block: Block;
  blockIdx: number;
  onBlockDrop: (draggedIdx: number, targetIdx: number) => void;
  onExerciseDrop: (item: DraggableExerciseData, targetIdx: number) => void;
  onEditExercise: (exerciseIdx: number, supersetIdx?: number) => void;
  onDeleteExercise: (exerciseIdx: number, supersetIdx?: number) => void;
  onAddExercise: () => void;
  onAddExerciseToSuperset: (supersetIdx: number) => void;
  onAddSuperset: () => void;
  onDeleteSuperset: (supersetIdx: number) => void;
  onExerciseDrop: (item: DraggableExerciseData, targetIdx: number, targetSupersetIdx?: number) => void;
  onUpdateBlock: (updates: Partial<Block>) => void;
  collapseSignal?: { action: 'collapse' | 'expand'; timestamp: number };
}) {
  const [{ isDragging }, drag, dragPreview] = useDrag(() => ({
    type: ItemTypes.BLOCK,
    item: { blockIdx, block } as DraggableBlockData,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ItemTypes.BLOCK,
    drop: (item: DraggableBlockData) => {
      if (item.blockIdx !== blockIdx) {
        onBlockDrop(item.blockIdx, blockIdx);
      }
    },
    canDrop: (item) => item.blockIdx !== blockIdx,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  const [editingLabel, setEditingLabel] = useState(false);
  const [tempLabel, setTempLabel] = useState(block.label);
  const [isCollapsed, setIsCollapsed] = useState(true);

  // React to collapse/expand all signal
  useEffect(() => {
    if (collapseSignal) {
      if (collapseSignal.action === 'collapse') {
        setIsCollapsed(true);
      } else if (collapseSignal.action === 'expand') {
        setIsCollapsed(false);
      }
    }
  }, [collapseSignal]);

  const saveLabel = () => {
    onUpdateBlock({ label: tempLabel });
    setEditingLabel(false);
  };

  // Count total exercises in block (including supersets)
  const blockExercises = block.exercises?.length || 0;
  const supersetExercises = (block.supersets || []).reduce(
    (sum, ss) => sum + (ss.exercises?.length || 0),
    0
  );
  const totalExerciseCount = blockExercises + supersetExercises;

  // Get structure-specific display info
  const getStructureInfo = () => {
    const parts: string[] = [];
    if (block.structure === 'rounds' && block.rounds) {
      parts.push(`${block.rounds} rounds`);
    }
    if (block.structure === 'sets' && block.sets) {
      parts.push(`${block.sets} sets`);
    }
    if (block.rest_between_rounds_sec) {
      parts.push(`Rest: ${block.rest_between_rounds_sec}s`);
    }
    if (block.rest_between_sets_sec) {
      parts.push(`Rest: ${block.rest_between_sets_sec}s`);
    }
    if (block.time_work_sec && block.time_rest_sec) {
      parts.push(`Work: ${block.time_work_sec}s / Rest: ${block.time_rest_sec}s`);
    }
    if (block.time_cap_sec) {
      const minutes = Math.floor(block.time_cap_sec / 60);
      const seconds = block.time_cap_sec % 60;
      parts.push(`Cap: ${minutes}:${String(seconds).padStart(2, '0')}`);
    }
    return parts;
  };

  return (
    <div ref={drop}>
      {/* Drop zone indicator at top of block */}
      {isOver && canDrop && (
        <div className="h-2 bg-primary/20 border-2 border-dashed border-primary rounded mb-2 transition-all">
          <div className="h-full bg-primary/40 animate-pulse" />
        </div>
      )}
      
      <div ref={dragPreview}>
        <Card 
          className={`transition-all ${isDragging ? 'opacity-40 rotate-1 scale-95' : 'opacity-100'} ${isOver && canDrop ? 'ring-2 ring-primary shadow-lg' : ''}`}
        >
          <CardHeader className="bg-muted/30">
            <div className="flex items-center gap-2">
              <div 
                ref={drag}
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted/50 p-1 rounded transition-colors"
              >
                <GripVertical className="w-5 h-5" />
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-0 h-auto hover:bg-transparent"
              >
                {isCollapsed ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                )}
              </Button>
              {editingLabel ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={tempLabel}
                    onChange={(e) => setTempLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveLabel()}
                    className="max-w-md"
                  />
                  <Button size="sm" onClick={saveLabel}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingLabel(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <CardTitle className="text-lg">{block.label}</CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setEditingLabel(true)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  {isCollapsed && (
                    <Badge variant="secondary" className="text-xs">
                      {totalExerciseCount} exercise{totalExerciseCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              )}
              {block.structure && (
                <Badge variant="outline">{getStructureDisplayName(block.structure)}</Badge>
              )}
            </div>
            {!isCollapsed && getStructureInfo().length > 0 && (
              <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                {getStructureInfo().map((info, idx) => (
                  <span key={idx}>{info}</span>
                ))}
              </div>
            )}
          </CardHeader>
          {!isCollapsed && (
            <CardContent className="space-y-4">
              {/* Block-level exercises */}
              {(block.exercises || []).length > 0 && (
                <div>
                <ExerciseDropZone
                  blockIdx={blockIdx}
                  exercises={block.exercises || []}
                  onDrop={(item, targetIdx) => onExerciseDrop(item, targetIdx)}
                  onEdit={(idx) => onEditExercise(idx)}
                  onDelete={(idx) => onDeleteExercise(idx)}
                  label="Exercises"
                  supersetIdx={undefined}
                />
                </div>
              )}

              {/* Supersets */}
              {(block.supersets || []).length > 0 && (
                <div className="space-y-3">
                  {(block.supersets || []).map((superset, supersetIdx) => (
                    <div key={superset.id || supersetIdx} className="border-l-4 border-primary pl-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Superset {supersetIdx + 1}
                          </Badge>
                          {superset.rest_between_sec && (
                            <span className="text-xs text-muted-foreground">
                              {superset.rest_between_sec}s rest
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteSuperset(supersetIdx)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <ExerciseDropZone
                        blockIdx={blockIdx}
                        exercises={superset.exercises || []}
                        onDrop={(item, targetIdx) => {
                          // Handle drop into superset - pass supersetIdx to handleExerciseDrop
                          onExerciseDrop(item, targetIdx, supersetIdx);
                        }}
                        onEdit={(idx) => {
                          // Edit exercise in superset - pass supersetIdx
                          onEditExercise(idx, supersetIdx);
                        }}
                        onDelete={(idx) => {
                          // Delete exercise from superset - pass supersetIdx
                          onDeleteExercise(idx, supersetIdx);
                        }}
                        label={`Superset ${supersetIdx + 1} Exercises`}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAddExerciseToSuperset(supersetIdx)}
                        className="w-full gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Exercise to Superset
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddExercise}
                  className="flex-1 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Exercise
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddSuperset}
                  className="flex-1 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Superset
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

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
    
    const hasAllIds = workout.blocks.every(b => {
      if (!b || !b.id) return false;
      const exercisesHaveIds = b.exercises && Array.isArray(b.exercises) && b.exercises.every(ex => ex && ex.id);
      const supersetsHaveIds = !b.supersets || (Array.isArray(b.supersets) && b.supersets.every(ss => 
        ss && ss.id && ss.exercises && Array.isArray(ss.exercises) && ss.exercises.every(ex => ex && ex.id)
      ));
      return exercisesHaveIds && supersetsHaveIds;
    });
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
    workout?.blocks?.map(b => b?.exercises?.map(e => e?.id || '').join(',') || '').join('|') || '',
    workout?.blocks?.map(b => b?.supersets?.map(ss => ss?.id || '').join(',') || '').join('|') || '',
    workout?.blocks?.map(b => b?.supersets?.map(ss => ss?.exercises?.map(e => e?.id || '').join(',') || '').join('|') || '').join('||') || ''
  ]);

  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(workoutWithIds.title);
  
  // Sync tempTitle when workout title changes externally
  useEffect(() => {
    if (!editingTitle) {
      setTempTitle(workoutWithIds.title);
    }
  }, [workoutWithIds.title, editingTitle]);
  const [editingExercise, setEditingExercise] = useState<{ blockIdx: number; exerciseIdx: number; supersetIdx?: number } | null>(null);
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [addingToBlock, setAddingToBlock] = useState<number | null>(null);
  const [addingToSuperset, setAddingToSuperset] = useState<{ blockIdx: number; supersetIdx: number } | null>(null);
  const [collapseSignal, setCollapseSignal] = useState<{ action: 'collapse' | 'expand'; timestamp: number } | undefined>(undefined);
  const [showDebugJson, setShowDebugJson] = useState(false);

  const availableDevices = getDevicesByIds(userSelectedDevices);

  const saveTitle = () => {
    onWorkoutChange({ ...workoutWithIds, title: tempTitle });
    setEditingTitle(false);
  };

  // Handle block drag and drop
  const handleBlockDrop = (draggedIdx: number, targetIdx: number) => {
    if (draggedIdx === targetIdx) return;
    
    const newWorkout = JSON.parse(JSON.stringify(workoutWithIds));
    const [draggedBlock] = newWorkout.blocks.splice(draggedIdx, 1);
    
    // Adjust target index if dragging down
    const adjustedTargetIdx = draggedIdx < targetIdx ? targetIdx - 1 : targetIdx;
    
    newWorkout.blocks.splice(adjustedTargetIdx, 0, draggedBlock);
    onWorkoutChange(newWorkout);
  };

  // Handle exercise drag and drop
  const handleExerciseDrop = (
    item: DraggableExerciseData,
    targetBlockIdx: number,
    targetExerciseIdx: number,
    targetSupersetIdx?: number
  ) => {
    const newWorkout = JSON.parse(JSON.stringify(workoutWithIds));
    
    // Get exercise from source (block-level or superset)
    let draggedExercise: Exercise;
    if (item.supersetIdx !== undefined) {
      // Remove from source superset
      draggedExercise = newWorkout.blocks[item.blockIdx].supersets[item.supersetIdx].exercises.splice(item.exerciseIdx, 1)[0];
    } else {
      // Remove from source block-level exercises
      if (!newWorkout.blocks[item.blockIdx].exercises) {
        newWorkout.blocks[item.blockIdx].exercises = [];
      }
      draggedExercise = newWorkout.blocks[item.blockIdx].exercises.splice(item.exerciseIdx, 1)[0];
    }
    
    // Add to target (block-level or superset)
    if (targetSupersetIdx !== undefined) {
      // Add to target superset
      if (!newWorkout.blocks[targetBlockIdx].supersets) {
        newWorkout.blocks[targetBlockIdx].supersets = [];
      }
      if (!newWorkout.blocks[targetBlockIdx].supersets[targetSupersetIdx]) {
        newWorkout.blocks[targetBlockIdx].supersets[targetSupersetIdx] = {
          id: generateId(),
          exercises: [],
          rest_between_sec: 60,
        };
      }
      if (!newWorkout.blocks[targetBlockIdx].supersets[targetSupersetIdx].exercises) {
        newWorkout.blocks[targetBlockIdx].supersets[targetSupersetIdx].exercises = [];
      }
      newWorkout.blocks[targetBlockIdx].supersets[targetSupersetIdx].exercises.splice(targetExerciseIdx, 0, draggedExercise);
    } else {
      // Add to target block-level exercises
      if (!newWorkout.blocks[targetBlockIdx].exercises) {
        newWorkout.blocks[targetBlockIdx].exercises = [];
      }
      newWorkout.blocks[targetBlockIdx].exercises.splice(targetExerciseIdx, 0, draggedExercise);
    }
    
    onWorkoutChange(newWorkout);
  };

  const updateExercise = (blockIdx: number, exerciseIdx: number, updates: Partial<Exercise>) => {
    const newWorkout = JSON.parse(JSON.stringify(workoutWithIds));
    const exercise = newWorkout.blocks[blockIdx].exercises[exerciseIdx];
    newWorkout.blocks[blockIdx].exercises[exerciseIdx] = { ...exercise, ...updates };
    onWorkoutChange(newWorkout);
    setEditingExercise(null);
  };

  const deleteExercise = (blockIdx: number, exerciseIdx: number) => {
    const newWorkout = JSON.parse(JSON.stringify(workoutWithIds));
    if (newWorkout.blocks[blockIdx].exercises) {
      newWorkout.blocks[blockIdx].exercises.splice(exerciseIdx, 1);
    }
    onWorkoutChange(newWorkout);
  };

  const addExercise = (blockIdx: number, exerciseName: string, supersetIdx?: number) => {
    const newWorkout = JSON.parse(JSON.stringify(workoutWithIds));
    const newExercise: Exercise = {
      id: generateId(),
      name: exerciseName,
      sets: 3,
      reps: 10,
      reps_range: null,
      duration_sec: null,
      rest_sec: 60,
      distance_m: null,
      distance_range: null,
      type: 'strength',
      notes: null
    };
    
    if (supersetIdx !== undefined) {
      // Add to superset
      if (!newWorkout.blocks[blockIdx].supersets) {
        newWorkout.blocks[blockIdx].supersets = [];
      }
      if (!newWorkout.blocks[blockIdx].supersets[supersetIdx]) {
        newWorkout.blocks[blockIdx].supersets[supersetIdx] = {
          id: generateId(),
          exercises: [],
          rest_between_sec: 60,
        };
      }
      if (!newWorkout.blocks[blockIdx].supersets[supersetIdx].exercises) {
        newWorkout.blocks[blockIdx].supersets[supersetIdx].exercises = [];
      }
      newWorkout.blocks[blockIdx].supersets[supersetIdx].exercises.push(newExercise);
    } else {
      // Add to block-level exercises
      if (!newWorkout.blocks[blockIdx].exercises) {
        newWorkout.blocks[blockIdx].exercises = [];
      }
      newWorkout.blocks[blockIdx].exercises.push(newExercise);
    }
    
    onWorkoutChange(newWorkout);
    setShowExerciseSearch(false);
    setAddingToBlock(null);
    setAddingToSuperset(null);
  };

  const addSuperset = (blockIdx: number) => {
    const newWorkout = JSON.parse(JSON.stringify(workoutWithIds));
    if (!newWorkout.blocks[blockIdx].supersets) {
      newWorkout.blocks[blockIdx].supersets = [];
    }
    const newSuperset = {
      id: generateId(),
      exercises: [],
      rest_between_sec: 60,
    };
    newWorkout.blocks[blockIdx].supersets.push(newSuperset);
    onWorkoutChange(newWorkout);
  };

  const deleteSuperset = (blockIdx: number, supersetIdx: number) => {
    const newWorkout = JSON.parse(JSON.stringify(workoutWithIds));
    if (newWorkout.blocks[blockIdx].supersets) {
      newWorkout.blocks[blockIdx].supersets.splice(supersetIdx, 1);
    }
    onWorkoutChange(newWorkout);
  };

  const addBlock = () => {
    const newWorkout = JSON.parse(JSON.stringify(workoutWithIds));
    const newBlock: Block = {
      id: generateId(),
      label: `Block ${(workoutWithIds.blocks || []).length + 1}`,
      structure: null,
      exercises: [],
    };
    newWorkout.blocks.push(newBlock);
    onWorkoutChange(newWorkout);
  };

  const updateBlock = (blockIdx: number, updates: Partial<Block>) => {
    const newWorkout = JSON.parse(JSON.stringify(workoutWithIds));
    newWorkout.blocks[blockIdx] = { ...newWorkout.blocks[blockIdx], ...updates };
    onWorkoutChange(newWorkout);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {editingTitle ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={tempTitle}
                      onChange={(e) => setTempTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                      className="max-w-md"
                    />
                    <Button size="sm" onClick={saveTitle}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CardTitle>{workoutWithIds.title || 'Untitled Workout'}</CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => setEditingTitle(true)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Target Device</Label>
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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Move className="w-4 h-4" />
            <span>Drag blocks and exercises to reorder</span>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setCollapseSignal({ action: 'collapse', timestamp: Date.now() })} 
              variant="outline" 
              size="sm"
              className="gap-2"
            >
              <Minimize2 className="w-4 h-4" />
              Collapse All
            </Button>
            <Button 
              onClick={() => setCollapseSignal({ action: 'expand', timestamp: Date.now() })} 
              variant="outline" 
              size="sm"
              className="gap-2"
            >
              <Maximize2 className="w-4 h-4" />
              Expand All
            </Button>
            <Button onClick={addBlock} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Block
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-400px)] min-h-[400px]">
          <div className="space-y-4 pr-4 pb-8">
            {(!workoutWithIds.blocks || workoutWithIds.blocks.length === 0) ? (
              <div className="text-center text-muted-foreground py-8">
                <p className="mb-2">No blocks yet. Click "Add Block" to get started.</p>
              </div>
            ) : (
              workoutWithIds.blocks.map((block, blockIdx) => (
                <DraggableBlock
                  key={block.id || blockIdx}
                  block={block}
                  blockIdx={blockIdx}
                  onBlockDrop={handleBlockDrop}
                  onExerciseDrop={(item, targetIdx, targetSupersetIdx) => handleExerciseDrop(item, blockIdx, targetIdx, targetSupersetIdx)}
                  onEditExercise={(exerciseIdx, supersetIdx) => setEditingExercise({ blockIdx, exerciseIdx, supersetIdx })}
                  onDeleteExercise={(exerciseIdx, supersetIdx) => deleteExercise(blockIdx, exerciseIdx, supersetIdx)}
                  onAddExercise={() => {
                    setAddingToBlock(blockIdx);
                    setAddingToSuperset(null);
                    setShowExerciseSearch(true);
                  }}
                  onAddExerciseToSuperset={(supersetIdx) => {
                    setAddingToBlock(blockIdx);
                    setAddingToSuperset({ blockIdx, supersetIdx });
                    setShowExerciseSearch(true);
                  }}
                  onAddSuperset={() => addSuperset(blockIdx)}
                  onDeleteSuperset={(supersetIdx) => deleteSuperset(blockIdx, supersetIdx)}
                  onUpdateBlock={(updates) => updateBlock(blockIdx, updates)}
                  collapseSignal={collapseSignal}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Exercise Search Modal */}
        {showExerciseSearch && addingToBlock !== null && (
          <ExerciseSearch
            onSelect={(exerciseName) => addExercise(addingToBlock, exerciseName)}
            onClose={() => {
              setShowExerciseSearch(false);
              setAddingToBlock(null);
            }}
            device={selectedDevice}
          />
        )}

        {/* Edit Exercise Dialog */}
        <Dialog open={!!editingExercise} onOpenChange={(open) => !open && setEditingExercise(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Exercise</DialogTitle>
              <DialogDescription>
                Update the exercise details below
              </DialogDescription>
            </DialogHeader>
            {editingExercise && (() => {
              const { blockIdx, exerciseIdx, supersetIdx } = editingExercise;
              const exercise = supersetIdx !== undefined
                ? workoutWithIds.blocks[blockIdx].supersets?.[supersetIdx]?.exercises?.[exerciseIdx]
                : workoutWithIds.blocks[blockIdx].exercises[exerciseIdx];
              
              if (!exercise) {
                setEditingExercise(null);
                return null;
              }
              
              return (
                <div className="space-y-4">
                  <div>
                    <Label>Exercise Name</Label>
                    <Input
                      value={exercise.name}
                      onChange={(e) => updateExercise(blockIdx, exerciseIdx, { name: e.target.value }, supersetIdx)}
                      placeholder="Exercise name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Sets</Label>
                      <Input
                        type="number"
                        value={exercise.sets || ''}
                        onChange={(e) => updateExercise(blockIdx, exerciseIdx, { sets: parseInt(e.target.value) || null })}
                        placeholder="Sets"
                      />
                    </div>
                    <div>
                      <Label>Reps</Label>
                      <Input
                        type="number"
                        value={exercise.reps || ''}
                        onChange={(e) => updateExercise(blockIdx, exerciseIdx, { reps: parseInt(e.target.value) || null })}
                        placeholder="Reps"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Reps Range</Label>
                      <Input
                        value={exercise.reps_range || ''}
                        placeholder="e.g., 10-12"
                        onChange={(e) => updateExercise(blockIdx, exerciseIdx, { reps_range: e.target.value || null })}
                      />
                    </div>
                    <div>
                      <Label>Rest (sec)</Label>
                      <Input
                        type="number"
                        value={exercise.rest_sec || ''}
                        onChange={(e) => updateExercise(blockIdx, exerciseIdx, { rest_sec: parseInt(e.target.value) || null })}
                        placeholder="Rest"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Duration (sec)</Label>
                      <Input
                        type="number"
                        value={exercise.duration_sec || ''}
                        onChange={(e) => updateExercise(blockIdx, exerciseIdx, { duration_sec: parseInt(e.target.value) || null })}
                        placeholder="Duration"
                      />
                    </div>
                    <div>
                      <Label>Distance (m)</Label>
                      <Input
                        type="number"
                        value={exercise.distance_m || ''}
                        onChange={(e) => updateExercise(blockIdx, exerciseIdx, { distance_m: parseInt(e.target.value) || null })}
                        placeholder="Distance"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Distance Range</Label>
                    <Input
                      value={exercise.distance_range || ''}
                      placeholder="e.g., 100-200m"
                      onChange={(e) => updateExercise(blockIdx, exerciseIdx, { distance_range: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input
                      value={exercise.notes || ''}
                      placeholder="Optional notes"
                      onChange={(e) => updateExercise(blockIdx, exerciseIdx, { notes: e.target.value || null })}
                    />
                  </div>
                  <Button onClick={() => setEditingExercise(null)} className="w-full">
                    Done
                  </Button>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

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
    </DndProvider>
  );
}
