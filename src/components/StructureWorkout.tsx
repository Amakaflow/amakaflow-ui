import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Watch, Bike, Wand2, ShieldCheck, Edit2, Check, Trash2, GripVertical, Plus, Layers, Move, ChevronDown, ChevronUp, Minimize2, Maximize2, Save, Code, Download, Send, Info, Clock, Copy } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { WorkoutStructure, Exercise, Block, Superset, RestType, WorkoutSettings } from '../types/workout';
import { DeviceId, getDevicesByIds, getDeviceById, Device, getPrimaryExportDestinations } from '../lib/devices';
import { ExerciseSearch } from './ExerciseSearch';
import { Badge } from './ui/badge';
import { addIdsToWorkout, generateId, getStructureDisplayName } from '../lib/workout-utils';
import { EditExerciseDialog } from './EditExerciseDialog';
import { EditBlockDialog, BlockUpdates } from './EditBlockDialog';
import { WorkoutSettingsDialog } from './WorkoutSettingsDialog';

// ============================================================================
// Immutable helpers for Workout cloning (Industry-standard: avoid JSON.parse(JSON.stringify))
// ============================================================================
function cloneExercise(ex: Exercise): Exercise {
  return { ...ex };
}

function cloneSuperset(s: Superset): Superset {
  return {
    ...s,
    exercises: (s.exercises || []).map(cloneExercise),
  };
}

function cloneBlock(b: Block): Block {
  return {
    ...b,
    exercises: (b.exercises || []).map(cloneExercise),
    supersets: b.supersets ? b.supersets.map(cloneSuperset) : undefined,
  };
}

function cloneWorkout(w: WorkoutStructure): WorkoutStructure {
  return {
    ...w,
    blocks: (w.blocks || []).map(cloneBlock),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type Props = {
  workout: WorkoutStructure;
  onWorkoutChange: (workout: WorkoutStructure) => void;
  onAutoMap: () => void;
  onValidate: () => void;
  onSave?: () => void | Promise<void>;
  isEditingFromHistory?: boolean;
  isCreatingFromScratch?: boolean;
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
  effectiveRestType,
  effectiveRestSec,
  isInSuperset = false,
}: {
  exercise: Exercise;
  blockIdx: number;
  exerciseIdx: number;
  supersetIdx?: number;
  onEdit: () => void;
  onDelete: () => void;
  effectiveRestType?: string;  // From workout/block settings
  effectiveRestSec?: number;   // From workout/block settings
  isInSuperset?: boolean;      // If true, rest happens after superset, not each set
}) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.EXERCISE,
    item: { blockIdx, exerciseIdx, exercise, supersetIdx } as DraggableExerciseData,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const getDisplayName = () => {
    // Just return the exercise name - don't prepend duration/distance
    // Duration/distance will be shown separately in badges
    return exercise.name || '';
  };

  const getDisplayText = () => {
    const parts: string[] = [];
    // Show warmup sets indicator if configured (AMA-94)
    if (exercise.warmup_sets && exercise.warmup_sets > 0 && exercise.warmup_reps && exercise.warmup_reps > 0) {
      parts.push(`🔥 ${exercise.warmup_sets}×${exercise.warmup_reps} warmup`);
    }
    if (exercise.sets) parts.push(`${exercise.sets} sets`);
    if (exercise.reps) parts.push(`${exercise.reps} reps`);
    if (exercise.reps_range) parts.push(`${exercise.reps_range} reps`);
    if (exercise.duration_sec) {
      const minutes = Math.floor(exercise.duration_sec / 60);
      const seconds = exercise.duration_sec % 60;
      if (minutes > 0) {
        parts.push(seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`);
      } else {
        parts.push(`${seconds}s`);
      }
    }
    if (exercise.distance_m) parts.push(`${exercise.distance_m}m`);
    if (exercise.distance_range) parts.push(`${exercise.distance_range}`);

    // Show rest info - only if explicitly configured on exercise, block, or workout
    // For supersets: rest happens after the superset, not after each set within
    if (!isInSuperset) {
      // Check if exercise has explicit rest settings
      const hasExerciseRest = exercise.rest_type || exercise.rest_sec;
      // Check if block/workout has configured rest
      const hasEffectiveRest = effectiveRestType || effectiveRestSec;

      if (hasExerciseRest || hasEffectiveRest) {
        const restType = exercise.rest_type || effectiveRestType;
        const restSec = exercise.rest_sec ?? effectiveRestSec;

        if (restType === 'button') {
          parts.push(`⏱️ Lap Button rest`);
        } else if (restSec && restSec > 0) {
          const mins = Math.floor(restSec / 60);
          const secs = restSec % 60;
          if (mins > 0 && secs > 0) {
            parts.push(`⏱️ ${mins}m ${secs}s rest`);
          } else if (mins > 0) {
            parts.push(`⏱️ ${mins}m rest`);
          } else {
            parts.push(`⏱️ ${restSec}s rest`);
          }
        }
      }
    }
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
// Industry-standard: ExerciseDropZone focuses on UI + drop intent, not business logic like sorting
// Array order in state is the single source of truth
function ExerciseDropZone({
  blockIdx,
  exercises,
  onDrop,
  onEdit,
  onDelete,
  label,
  supersetIdx,
  effectiveRestType,
  effectiveRestSec,
  isInSuperset = false,
}: {
  blockIdx: number;
  exercises: Exercise[];
  onDrop: (item: DraggableExerciseData, targetIdx: number, targetSupersetIdx?: number) => void;
  onEdit: (exerciseIdx: number) => void;
  onDelete: (exerciseIdx: number) => void;
  label?: string;
  supersetIdx?: number;
  effectiveRestType?: string;
  effectiveRestSec?: number;
  isInSuperset?: boolean;
}) {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: ItemTypes.EXERCISE,
      drop: (item: DraggableExerciseData) => {
        // For now, this drop zone appends to the end of its container.
        // More advanced patterns (above/below/into) should be handled
        // with additional sub-zones or hover position logic.
        const targetIdx = exercises.length;
        onDrop(item, targetIdx, supersetIdx);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    }),
    [exercises.length, supersetIdx, onDrop]
  );

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
          key={exercise.id}
          exercise={exercise}
          blockIdx={blockIdx}
          exerciseIdx={idx}
          supersetIdx={supersetIdx}
          onEdit={() => onEdit(idx)}
          onDelete={() => onDelete(idx)}
          effectiveRestType={effectiveRestType}
          effectiveRestSec={effectiveRestSec}
          isInSuperset={isInSuperset}
        />
      ))}
    </div>
  );
}

// Draggable Block Component
function DraggableBlock({
  block,
  blockIdx,
  workoutSettings,
  onBlockDrop,
  onExerciseDrop,
  onEditExercise,
  onDeleteExercise,
  onAddExercise,
  onAddExerciseToSuperset,
  onAddSuperset,
  onDeleteSuperset,
  onUpdateBlock,
  onEditBlock,
  collapseSignal,
}: {
  block: Block;
  blockIdx: number;
  workoutSettings?: WorkoutSettings;
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
  onEditBlock: () => void;
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

  const [isCollapsed, setIsCollapsed] = useState(true);
  // Track collapsed state per superset (keyed by superset index)
  const [collapsedSupersets, setCollapsedSupersets] = useState<Record<number, boolean>>({});

  const toggleSupersetCollapse = (supersetIdx: number) => {
    setCollapsedSupersets(prev => ({
      ...prev,
      [supersetIdx]: !prev[supersetIdx]
    }));
  };

  // React to collapse/expand all signal
  useEffect(() => {
    if (collapseSignal) {
      if (collapseSignal.action === 'collapse') {
        setIsCollapsed(true);
        // Collapse all supersets
        const allCollapsed: Record<number, boolean> = {};
        (block.supersets || []).forEach((_, idx) => {
          allCollapsed[idx] = true;
        });
        setCollapsedSupersets(allCollapsed);
      } else if (collapseSignal.action === 'expand') {
        setIsCollapsed(false);
        // Expand all supersets
        setCollapsedSupersets({});
      }
    }
  }, [collapseSignal, block.supersets]);

  // Count total exercises in block (including supersets)
  const blockExercises = block.exercises?.length || 0;
  const supersetExercises = (block.supersets || []).reduce(
    (sum, ss) => sum + (ss.exercises?.length || 0),
    0
  );
  const totalExerciseCount = blockExercises + supersetExercises;

  // Calculate effective rest settings (block override > workout default)
  // This is passed to exercise cards so they show the correct rest indicator
  // Only set values if explicitly configured - don't default to anything
  const effectiveRestType = block.restOverride?.enabled
    ? block.restOverride.restType
    : workoutSettings?.defaultRestType;  // No default - only show if configured
  const effectiveRestSec = block.restOverride?.enabled
    ? block.restOverride.restSec
    : workoutSettings?.defaultRestSec;

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
              <div className="flex items-center gap-2 flex-1">
                <CardTitle className="text-lg">{block.label}</CardTitle>
                <Button size="sm" variant="ghost" onClick={onEditBlock} title="Edit Block">
                  <Edit2 className="w-4 h-4" />
                </Button>
                {isCollapsed && (
                  <Badge variant="secondary" className="text-xs">
                    {totalExerciseCount} exercise{totalExerciseCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {block.structure && (
                  <Badge variant="outline">{getStructureDisplayName(block.structure)}</Badge>
                )}
                {/* Rest indicator - only show if explicitly configured (block override or workout default) */}
                {(() => {
                  // Only show if rest is explicitly configured
                  const hasBlockOverride = block.restOverride?.enabled;
                  const hasWorkoutDefault = workoutSettings?.defaultRestType;

                  if (!hasBlockOverride && !hasWorkoutDefault) {
                    return null;  // Not configured - don't show
                  }

                  const restType = hasBlockOverride
                    ? block.restOverride?.restType
                    : workoutSettings?.defaultRestType;
                  const restSec = hasBlockOverride
                    ? block.restOverride?.restSec
                    : workoutSettings?.defaultRestSec;

                  let label: string;
                  if (restType === 'button') {
                    label = 'Rest: Lap Button';  // TODO: Make device-aware
                  } else if (restSec) {
                    const mins = Math.floor(restSec / 60);
                    const secs = restSec % 60;
                    if (mins > 0 && secs > 0) label = `Rest: ${mins}m ${secs}s`;
                    else if (mins > 0) label = `Rest: ${mins}m`;
                    else label = `Rest: ${secs}s`;
                  } else {
                    return null;  // No valid rest config
                  }

                  return (
                    <Badge variant={hasBlockOverride ? "secondary" : "outline"} className="text-xs gap-1">
                      <Clock className="w-3 h-3" />
                      {label}
                    </Badge>
                  );
                })()}
              </div>
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
              {/* Exercises at index 0 (before supersets) - show if supersets exist */}
              {(block.supersets || []).length > 0 && (block.exercises || []).length > 0 && (
                <div>
                  <ExerciseDropZone
                    blockIdx={blockIdx}
                    exercises={(block.exercises || []).slice(0, 1)} // Only show first exercise if it exists
                    onDrop={(item, targetIdx) => {
                      // Drop at index 0 to place above supersets
                      onExerciseDrop(item, 0);
                    }}
                    onEdit={(idx) => onEditExercise(0)}
                    onDelete={(idx) => onDeleteExercise(0)}
                    label={(block.exercises || []).length > 0 ? "Exercises" : undefined}
                    supersetIdx={undefined}
                    effectiveRestType={effectiveRestType}
                    effectiveRestSec={effectiveRestSec}
                    isInSuperset={false}
                  />
                </div>
              )}

              {/* Drop zone before supersets - allows dragging exercises above supersets (empty zone) */}
              {(block.supersets || []).length > 0 && (block.exercises || []).length === 0 && (
                <div>
                  <ExerciseDropZone
                    blockIdx={blockIdx}
                    exercises={[]}
                    onDrop={(item) => {
                      // Drop at index 0 to place above supersets
                      onExerciseDrop(item, 0);
                    }}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    label={undefined}
                    supersetIdx={undefined}
                    effectiveRestType={effectiveRestType}
                    effectiveRestSec={effectiveRestSec}
                    isInSuperset={false}
                  />
                </div>
              )}

              {/* Supersets */}
              {(block.supersets || []).length > 0 && (
                <div className="space-y-3">
                  {(block.supersets || []).map((superset, supersetIdx) => {
                    const isSupersetCollapsed = collapsedSupersets[supersetIdx] ?? false;
                    const exerciseCount = superset.exercises?.length || 0;

                    // Build summary info for collapsed view
                    const getSupersetSummary = () => {
                      const parts: string[] = [];
                      parts.push(`${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`);

                      // Show rounds if set
                      if (superset.rounds && superset.rounds > 1) {
                        parts.push(`${superset.rounds} rounds`);
                      }

                      // Show rest type
                      if (superset.rest_type === 'button') {
                        parts.push('Lap Button');
                      } else if (superset.rest_between_sec) {
                        const mins = Math.floor(superset.rest_between_sec / 60);
                        const secs = superset.rest_between_sec % 60;
                        if (mins > 0 && secs > 0) parts.push(`${mins}m ${secs}s rest`);
                        else if (mins > 0) parts.push(`${mins}m rest`);
                        else parts.push(`${secs}s rest`);
                      }

                      return parts.join(' • ');
                    };

                    return (
                      <div key={superset.id || supersetIdx} className="border-l-4 border-primary pl-4 space-y-2">
                        <div
                          className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -ml-4 pl-4 py-1 rounded-r transition-colors"
                          onClick={() => toggleSupersetCollapse(supersetIdx)}
                        >
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="p-0 h-auto hover:bg-transparent"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSupersetCollapse(supersetIdx);
                              }}
                            >
                              {isSupersetCollapsed ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Badge variant="outline" className="text-xs">
                              Superset {supersetIdx + 1}
                            </Badge>
                            {/* Show summary when collapsed */}
                            {isSupersetCollapsed && (
                              <span className="text-xs text-muted-foreground">
                                {getSupersetSummary()}
                              </span>
                            )}
                            {/* Show superset-specific rest when expanded */}
                            {!isSupersetCollapsed && (superset.rest_between_sec || superset.rest_type) && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Clock className="w-3 h-3" />
                                {superset.rest_type === 'button'
                                  ? 'Lap Button'
                                  : superset.rest_between_sec
                                    ? (() => {
                                        const mins = Math.floor(superset.rest_between_sec / 60);
                                        const secs = superset.rest_between_sec % 60;
                                        if (mins > 0 && secs > 0) return `${mins}m ${secs}s`;
                                        if (mins > 0) return `${mins}m`;
                                        return `${secs}s`;
                                      })()
                                    : 'Lap Button'}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSuperset(supersetIdx);
                            }}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Exercises and Add button - only show when expanded */}
                        {!isSupersetCollapsed && (
                          <>
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
                              supersetIdx={supersetIdx}
                              effectiveRestType={effectiveRestType}
                              effectiveRestSec={effectiveRestSec}
                              isInSuperset={true}  // Rest happens after superset, not after each set
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
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Block-level exercises - show AFTER supersets (index 1+). We preserve the
                  array order; no extra sorting in the UI. */}
              <div>
                <ExerciseDropZone
                  blockIdx={blockIdx}
                  exercises={(block.exercises || [])
                    .slice((block.supersets || []).length > 0 ? 1 : 0)
                    .filter(ex => ex != null)}
                  onDrop={(item) => {
                    // When dropping below supersets, append to the end of all block-level exercises
                    // This ensures it goes after supersets in the UI
                    const finalTargetIdx = (block.exercises || []).length;
                    onExerciseDrop(item, finalTargetIdx);
                  }}
                  onEdit={(idx) => {
                    const baseIdx = (block.supersets || []).length > 0 ? 1 : 0;
                    // Map filtered index back to original array index
                    const filteredSlice = (block.exercises || []).slice(baseIdx).filter(ex => ex != null);
                    const originalSlice = (block.exercises || []).slice(baseIdx);
                    // Find the original index by counting non-null exercises up to idx
                    let count = 0;
                    let actualIdx = baseIdx;
                    for (let i = 0; i < originalSlice.length; i++) {
                      if (originalSlice[i] != null) {
                        if (count === idx) {
                          actualIdx = baseIdx + i;
                          break;
                        }
                        count++;
                      }
                    }
                    onEditExercise(actualIdx);
                  }}
                  onDelete={(idx) => {
                    const baseIdx = (block.supersets || []).length > 0 ? 1 : 0;
                    // Map filtered index back to original array index
                    const originalSlice = (block.exercises || []).slice(baseIdx);
                    let count = 0;
                    let actualIdx = baseIdx;
                    for (let i = 0; i < originalSlice.length; i++) {
                      if (originalSlice[i] != null) {
                        if (count === idx) {
                          actualIdx = baseIdx + i;
                          break;
                        }
                        count++;
                      }
                    }
                    onDeleteExercise(actualIdx);
                  }}
                  label={
                    (block.exercises || []).filter(ex => ex != null).length >
                    ((block.supersets || []).length > 0 ? 1 : 0)
                      ? 'Exercises'
                      : undefined
                  }
                  supersetIdx={undefined}
                  effectiveRestType={effectiveRestType}
                  effectiveRestSec={effectiveRestSec}
                  isInSuperset={false}
                />
              </div>

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
  isCreatingFromScratch = false,
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
        settings: workout?.settings,
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
    // Include settings to detect workout-level changes (AMA-96)
    JSON.stringify(workout?.settings || {}),
    // Include block labels to detect changes
    workout?.blocks?.map(b => b?.label || '').join('|') || '',
    // Stringify block IDs to detect actual changes (with null checks)
    workout?.blocks?.map(b => b?.id || '').join(',') || '',
    workout?.blocks?.map(b => b?.exercises?.map(e => e?.id || '').join(',') || '').join('|') || '',
    workout?.blocks?.map(b => b?.supersets?.map(ss => ss?.id || '').join(',') || '').join('|') || '',
    workout?.blocks?.map(b => b?.supersets?.map(ss => ss?.exercises?.map(e => e?.id || '').join(',') || '').join('|') || '').join('||') || '',
    // Include exercise names to detect when new exercises are added
    workout?.blocks?.map(b => b?.exercises?.map(e => e?.name || '').join(',') || '').join('|') || '',
    workout?.blocks?.map(b => b?.supersets?.map(ss => ss?.exercises?.map(e => e?.name || '').join(',') || '').join('|') || '').join('||') || '',
    // Include exercise properties to detect changes to distance, duration, reps, warmup, rest, etc.
    workout?.blocks?.map(b =>
      b?.exercises?.map(e =>
        `${e?.name || ''}|${e?.sets || ''}|${e?.reps || ''}|${e?.reps_range || ''}|${e?.duration_sec || ''}|${e?.distance_m || ''}|${e?.distance_range || ''}|${e?.rest_sec || ''}|${e?.rest_type || ''}|${e?.notes || ''}|${e?.warmup_sets || ''}|${e?.warmup_reps || ''}`
      ).join('||') || ''
    ).join('|||') || '',
    workout?.blocks?.map(b =>
      b?.supersets?.map(ss =>
        ss?.exercises?.map(e =>
          `${e?.name || ''}|${e?.sets || ''}|${e?.reps || ''}|${e?.reps_range || ''}|${e?.duration_sec || ''}|${e?.distance_m || ''}|${e?.distance_range || ''}|${e?.rest_sec || ''}|${e?.rest_type || ''}|${e?.notes || ''}|${e?.warmup_sets || ''}|${e?.warmup_reps || ''}`
        ).join('||') || ''
      ).join('|||') || ''
    ).join('||||') || ''
  ]);

  const [showWorkoutSettings, setShowWorkoutSettings] = useState(false);
  const [editingExercise, setEditingExercise] = useState<{ blockIdx: number; exerciseIdx: number; supersetIdx?: number } | null>(null);
  const [editingBlockIdx, setEditingBlockIdx] = useState<number | null>(null);
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [addingToBlock, setAddingToBlock] = useState<number | null>(null);
  const [addingToSuperset, setAddingToSuperset] = useState<{ blockIdx: number; supersetIdx: number } | null>(null);
  const [collapseSignal, setCollapseSignal] = useState<{ action: 'collapse' | 'expand'; timestamp: number } | undefined>(undefined);
  const [jsonCopied, setJsonCopied] = useState(false);

  const availableDevices = getDevicesByIds(userSelectedDevices);

  // Handle block drag and drop
  const handleBlockDrop = (draggedIdx: number, targetIdx: number) => {
    if (draggedIdx === targetIdx) return;
    
    const newWorkout = cloneWorkout(workoutWithIds);
    const [draggedBlock] = newWorkout.blocks.splice(draggedIdx, 1);
    
    // Adjust target index if dragging down
    const adjustedTargetIdx = draggedIdx < targetIdx ? targetIdx - 1 : targetIdx;
    
    newWorkout.blocks.splice(adjustedTargetIdx, 0, draggedBlock);
    onWorkoutChange(newWorkout);
  };

  // Industry-standard: Use indices from DraggableExerciseData instead of re-searching arrays by id/name
  // Perform immutable updates via clone helpers
  // Correctly adjust target index when moving within the same container
  const handleExerciseDrop = (
    item: DraggableExerciseData,
    targetBlockIdx: number,
    rawTargetExerciseIdx: number,
    targetSupersetIdx?: number
  ) => {
    const currentWorkout: WorkoutStructure | undefined = workout || workoutWithIds;
    if (!currentWorkout) return;

    const newWorkout = cloneWorkout(currentWorkout);

    const sourceBlockIdx = item.blockIdx;
    const sourceSupersetIdx = item.supersetIdx;
    const sourceExerciseIdx = item.exerciseIdx;

    const sourceBlock = newWorkout.blocks[sourceBlockIdx];
    const targetBlock = newWorkout.blocks[targetBlockIdx];

    if (!sourceBlock || !targetBlock) {
      console.warn('handleExerciseDrop: invalid block index', {
        sourceBlockIdx,
        targetBlockIdx,
      });
      return;
    }

    let movedExercise: Exercise | undefined;

    // 1) Remove from source
    if (sourceSupersetIdx !== undefined && sourceSupersetIdx !== null) {
      const sourceSuperset = sourceBlock.supersets?.[sourceSupersetIdx];
      if (!sourceSuperset || !sourceSuperset.exercises) {
        console.warn('handleExerciseDrop: invalid source superset', {
          sourceSupersetIdx,
        });
        return;
      }
      movedExercise = sourceSuperset.exercises[sourceExerciseIdx];
      if (!movedExercise) {
        console.warn('handleExerciseDrop: no exercise at source index', {
          sourceExerciseIdx,
        });
        return;
      }
      sourceSuperset.exercises.splice(sourceExerciseIdx, 1);
    } else {
      if (!sourceBlock.exercises) {
        console.warn('handleExerciseDrop: source block has no exercises');
        return;
      }
      movedExercise = sourceBlock.exercises[sourceExerciseIdx];
      if (!movedExercise) {
        console.warn('handleExerciseDrop: no exercise at source index', {
          sourceExerciseIdx,
        });
        return;
      }
      sourceBlock.exercises.splice(sourceExerciseIdx, 1);
    }

    // Safety check
    if (!movedExercise) {
      console.warn('handleExerciseDrop: movedExercise is undefined after removal');
      return;
    }

    // 2) Insert into target
    if (targetSupersetIdx !== undefined && targetSupersetIdx !== null) {
      // Ensure superset exists
      if (!targetBlock.supersets) {
        targetBlock.supersets = [];
      }
      if (!targetBlock.supersets[targetSupersetIdx]) {
        targetBlock.supersets[targetSupersetIdx] = {
          id: generateId(),
          exercises: [],
          rest_between_sec: 60,
        };
      }
      const targetSuperset = targetBlock.supersets[targetSupersetIdx];
      if (!targetSuperset.exercises) {
        targetSuperset.exercises = [];
      }

      let targetExerciseIdx = rawTargetExerciseIdx;

      // Adjust for moving within the same superset container
      const movingWithinSameSuperset =
        sourceBlockIdx === targetBlockIdx &&
        sourceSupersetIdx !== undefined &&
        sourceSupersetIdx === targetSupersetIdx;

      if (movingWithinSameSuperset && sourceExerciseIdx < rawTargetExerciseIdx) {
        targetExerciseIdx = rawTargetExerciseIdx - 1;
      }

      targetExerciseIdx = clamp(targetExerciseIdx, 0, targetSuperset.exercises.length);
      targetSuperset.exercises.splice(targetExerciseIdx, 0, movedExercise);
    } else {
      if (!targetBlock.exercises) {
        targetBlock.exercises = [];
      }

      let targetExerciseIdx = rawTargetExerciseIdx;

      // Adjust for moving within the same block-level exercises container
      const movingWithinSameBlockExercises =
        sourceBlockIdx === targetBlockIdx && (sourceSupersetIdx === undefined || sourceSupersetIdx === null);

      if (movingWithinSameBlockExercises && sourceExerciseIdx < rawTargetExerciseIdx) {
        targetExerciseIdx = rawTargetExerciseIdx - 1;
      }

      targetExerciseIdx = clamp(targetExerciseIdx, 0, targetBlock.exercises.length);
      targetBlock.exercises.splice(targetExerciseIdx, 0, movedExercise);
    }

    onWorkoutChange(newWorkout);
  };

  const updateExercise = (blockIdx: number, exerciseIdx: number, updates: Partial<Exercise>, supersetIdx?: number) => {
    // DEBUG: Log incoming updates
    console.log('[StructureWorkout] updateExercise:', {
      blockIdx,
      exerciseIdx,
      supersetIdx,
      warmup_sets: updates.warmup_sets,
      warmup_reps: updates.warmup_reps,
    });

    const newWorkout = cloneWorkout(workoutWithIds);

    if (supersetIdx !== undefined) {
      // Update exercise in superset
      const exercise = newWorkout.blocks[blockIdx].supersets?.[supersetIdx]?.exercises?.[exerciseIdx];
      if (exercise) {
        newWorkout.blocks[blockIdx].supersets[supersetIdx].exercises[exerciseIdx] = { ...exercise, ...updates };
      }
    } else {
      // Update exercise in block
      const exercise = newWorkout.blocks[blockIdx].exercises[exerciseIdx];
      if (exercise) {
        newWorkout.blocks[blockIdx].exercises[exerciseIdx] = { ...exercise, ...updates };
      }
    }

    onWorkoutChange(newWorkout);
    // Note: Don't close dialog here - let EditExerciseDialog manage its own state
  };

  const deleteExercise = (blockIdx: number, exerciseIdx: number, supersetIdx?: number) => {
    const newWorkout = cloneWorkout(workoutWithIds);
    
    if (supersetIdx !== undefined) {
      // Delete exercise from superset
      if (newWorkout.blocks[blockIdx].supersets?.[supersetIdx]?.exercises) {
        newWorkout.blocks[blockIdx].supersets[supersetIdx].exercises.splice(exerciseIdx, 1);
      }
    } else {
      // Delete exercise from block
      if (newWorkout.blocks[blockIdx].exercises) {
        newWorkout.blocks[blockIdx].exercises.splice(exerciseIdx, 1);
      }
    }
    
    onWorkoutChange(newWorkout);
  };

  // Industry-standard: Use cloneWorkout for immutability
  // Ensure new exercises always have an id and (optionally) addedAt for any upstream sorting
  // Let the array order define what the UI shows; don't override it inside the drop zone
  const addExercise = (blockIdx: number, exerciseName: string, supersetIdx?: number) => {
    const baseWorkout: WorkoutStructure | undefined = workoutWithIds || workout;
    if (!baseWorkout) return;

    const newWorkout = cloneWorkout(baseWorkout);

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
      notes: null,
      addedAt: Date.now(), // optional metadata; actual order is defined by array position
    };

    const block = newWorkout.blocks[blockIdx];
    if (!block) {
      console.warn('addExercise: invalid blockIdx', { blockIdx });
      return;
    }

    if (supersetIdx !== undefined && supersetIdx !== null) {
      if (!block.supersets) {
        block.supersets = [];
      }
      if (!block.supersets[supersetIdx]) {
        block.supersets[supersetIdx] = {
          id: generateId(),
          exercises: [],
          rest_between_sec: 60,
        };
      }
      if (!block.supersets[supersetIdx].exercises) {
        block.supersets[supersetIdx].exercises = [];
      }
      block.supersets[supersetIdx].exercises.push(newExercise);
    } else {
      if (!block.exercises) {
        block.exercises = [];
      }
      // When adding to block-level exercises:
      // - If there are supersets, we want the exercise to go AFTER supersets
      //   - Index 0 is shown before supersets (if it exists)
      //   - Index 1+ are shown after supersets
      //   - So if this is the first exercise with supersets, insert at index 1
      //   - Otherwise, append to end (will be at index 1+)
      // - If no supersets, append normally
      const hasSupersets = (block.supersets || []).length > 0;
      if (hasSupersets && block.exercises.length === 0) {
        // First exercise with supersets - insert at index 1 (after supersets)
        // This creates a sparse array, but that's okay - index 0 will be undefined
        block.exercises[1] = newExercise;
      } else {
        // Not the first exercise, or no supersets - append normally
        block.exercises.push(newExercise);
      }
    }

    onWorkoutChange(newWorkout);
    setShowExerciseSearch(false);
    setAddingToBlock(null);
    setAddingToSuperset(null);
  };

  const addSuperset = (blockIdx: number) => {
    const newWorkout = cloneWorkout(workoutWithIds);
    if (!newWorkout.blocks[blockIdx].supersets) {
      newWorkout.blocks[blockIdx].supersets = [];
    }
    const newSuperset: Superset = {
      id: generateId(),
      exercises: [],
      rest_between_sec: 60,
    };
    newWorkout.blocks[blockIdx].supersets.push(newSuperset);
    onWorkoutChange(newWorkout);
  };

  const deleteSuperset = (blockIdx: number, supersetIdx: number) => {
    const newWorkout = cloneWorkout(workoutWithIds);
    if (newWorkout.blocks[blockIdx].supersets) {
      newWorkout.blocks[blockIdx].supersets.splice(supersetIdx, 1);
    }
    onWorkoutChange(newWorkout);
  };

  const addBlock = () => {
    const newWorkout = cloneWorkout(workoutWithIds);
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
    const newWorkout = cloneWorkout(workoutWithIds);
    newWorkout.blocks[blockIdx] = { ...newWorkout.blocks[blockIdx], ...updates };
    onWorkoutChange(newWorkout);
  };

  // Handle workout-level settings changes (AMA-96)
  const handleWorkoutSettingsSave = (title: string, settings: WorkoutSettings) => {
    const newWorkout = cloneWorkout(workoutWithIds);
    newWorkout.title = title;
    newWorkout.settings = settings;
    onWorkoutChange(newWorkout);
  };

  // Helper to format rest settings for display - returns null if not configured
  const getRestSettingsLabel = (): string | null => {
    const settings = workoutWithIds.settings;
    // Only show if explicitly configured
    if (!settings?.defaultRestType) {
      return null;  // Not configured - don't show
    }
    if (settings.defaultRestType === 'button') {
      return 'Rest: Lap Button';  // TODO: Make device-aware (Garmin = Lap, Apple = Action, etc.)
    }
    if (settings.defaultRestType === 'timed' && settings.defaultRestSec) {
      const mins = Math.floor(settings.defaultRestSec / 60);
      const secs = settings.defaultRestSec % 60;
      if (mins > 0 && secs > 0) return `Rest: ${mins}m ${secs}s`;
      if (mins > 0) return `Rest: ${mins}m`;
      return `Rest: ${secs}s`;
    }
    return null;
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle>{workoutWithIds.title || 'Untitled Workout'}</CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setShowWorkoutSettings(true)} title="Workout Settings">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
                {/* Workout Settings Badges - only show if configured */}
                <div className="flex items-center gap-2 mt-2">
                  {getRestSettingsLabel() && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Clock className="w-3 h-3" />
                      {getRestSettingsLabel()}
                    </Badge>
                  )}
                  {workoutWithIds.settings?.workoutWarmup?.enabled && (
                    <Badge variant="outline" className="text-xs">
                      Warm-up: {workoutWithIds.settings.workoutWarmup.activity === 'custom'
                        ? 'Custom'
                        : workoutWithIds.settings.workoutWarmup.activity?.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Export Destination Selector */}
            <div className="space-y-3">
              <Label>Export Destination</Label>
              <Select value={selectedDevice} onValueChange={(value) => onDeviceChange(value as DeviceId)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {getPrimaryExportDestinations().map((device) => (
                    <SelectItem 
                      key={device.id} 
                      value={device.id}
                      disabled={device.exportMethod === 'coming_soon'}
                    >
                      <div className="flex items-center gap-2">
                        <span>{device.icon}</span>
                        <span>{device.name}</span>
                        {device.exportMethod === 'coming_soon' && (
                          <span className="text-xs text-muted-foreground ml-2">(Coming Soon)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Destination Info */}
              {(() => {
                const device = getDeviceById(selectedDevice);
                if (!device) return null;
                
                return (
                  <Alert className="bg-muted/50">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {device.requiresMapping ? (
                        <>
                          <strong>Requires exercise mapping.</strong> Your exercises will be matched to {device.name}'s exercise database for proper tracking on your device.
                        </>
                      ) : (
                        <>
                          <strong>Direct export.</strong> Your workout will be exported directly without exercise mapping.
                        </>
                      )}
                      {device.setupInstructions && (
                        <span className="block mt-1 text-muted-foreground">{device.setupInstructions}</span>
                      )}
                    </AlertDescription>
                  </Alert>
                );
              })()}
            </div>

            {/* Action Buttons - Dynamic based on destination */}
            <div className="flex gap-2 flex-wrap">
              {(() => {
                const device = getDeviceById(selectedDevice);
                const needsMapping = device?.requiresMapping ?? true;
                const isAvailable = device?.exportMethod !== 'coming_soon';

                if (!isAvailable) {
                  return (
                    <>
                      {onSave && (
                        <Button onClick={onSave} disabled={loading} className="gap-2">
                          <Save className="w-4 h-4" />
                          Save to Library
                        </Button>
                      )}
                      <Button disabled className="gap-2 opacity-50">
                        <Clock className="w-4 h-4" />
                        {device?.name} Coming Soon
                      </Button>
                    </>
                  );
                }

                if (isEditingFromHistory || isCreatingFromScratch) {
                  return (
                    <>
                      {onSave && (
                        <Button onClick={onSave} disabled={loading} className="gap-2">
                          <Save className="w-4 h-4" />
                          {isCreatingFromScratch ? 'Save Workout' : 'Save Changes'}
                        </Button>
                      )}
                      {isEditingFromHistory && needsMapping && (
                        <>
                          <Button onClick={onAutoMap} disabled={loading} variant="outline" className="gap-2">
                            <Wand2 className="w-4 h-4" />
                            Re-Map & Export
                          </Button>
                          <Button onClick={onValidate} disabled={loading} variant="outline" className="gap-2">
                            <ShieldCheck className="w-4 h-4" />
                            Validate & Review
                          </Button>
                        </>
                      )}
                      {isEditingFromHistory && !needsMapping && (
                        <Button onClick={onAutoMap} disabled={loading} variant="outline" className="gap-2">
                          {device?.exportMethod === 'file_download' ? (
                            <Download className="w-4 h-4" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          Export to {device?.name}
                        </Button>
                      )}
                    </>
                  );
                }

                // Normal flow (not editing)
                if (needsMapping) {
                  return (
                    <>
                      <Button onClick={onAutoMap} disabled={loading} className="gap-2">
                        <Wand2 className="w-4 h-4" />
                        Auto-Map & Export
                      </Button>
                      <Button onClick={onValidate} disabled={loading} variant="outline" className="gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Validate & Review
                      </Button>
                      {onSave && (
                        <Button onClick={onSave} disabled={loading} variant="ghost" className="gap-2">
                          <Save className="w-4 h-4" />
                          Save Draft
                        </Button>
                      )}
                    </>
                  );
                } else {
                  // Direct export (no mapping)
                  return (
                    <>
                      <Button onClick={onAutoMap} disabled={loading} className="gap-2">
                        {device?.exportMethod === 'file_download' ? (
                          <Download className="w-4 h-4" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Export to {device?.name}
                      </Button>
                      {onSave && (
                        <Button onClick={onSave} disabled={loading} variant="ghost" className="gap-2">
                          <Save className="w-4 h-4" />
                          Save Draft
                        </Button>
                      )}
                    </>
                  );
                }
              })()}
              {process.env.NODE_ENV === 'development' && (
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(workoutWithIds, null, 2));
                    setJsonCopied(true);
                    setTimeout(() => setJsonCopied(false), 2000);
                  }}
                  variant="outline"
                  className="gap-2"
                >
                  {jsonCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {jsonCopied ? 'Copied!' : 'Copy JSON'}
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
                  workoutSettings={workoutWithIds.settings}
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
                  onEditBlock={() => setEditingBlockIdx(blockIdx)}
                  collapseSignal={collapseSignal}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Exercise Search Modal */}
        {showExerciseSearch && addingToBlock !== null && (
          <ExerciseSearch
            onSelect={(exerciseName) => {
              const supersetIdx = addingToSuperset?.supersetIdx;
              addExercise(addingToBlock, exerciseName, supersetIdx);
            }}
            onClose={() => {
              setShowExerciseSearch(false);
              setAddingToBlock(null);
              setAddingToSuperset(null);
            }}
            device={selectedDevice}
          />
        )}

        {/* Edit Exercise Dialog */}
        {editingExercise && (() => {
          const { blockIdx, exerciseIdx, supersetIdx } = editingExercise;
          // Always read from current workout state to ensure updates are reflected
          const currentExercise = supersetIdx !== undefined
            ? workoutWithIds.blocks[blockIdx]?.supersets?.[supersetIdx]?.exercises?.[exerciseIdx]
            : workoutWithIds.blocks[blockIdx]?.exercises[exerciseIdx];
          
          if (!currentExercise) {
            // Exercise was deleted, close dialog
            setEditingExercise(null);
            return null;
          }
          
          return (
            <EditExerciseDialog
              key={`${blockIdx}-${exerciseIdx}-${supersetIdx ?? 'block'}`}
              open={!!editingExercise}
              exercise={currentExercise}
              onSave={(updates) => {
                // Live updates: onSave is called on every change, don't close dialog here
                updateExercise(blockIdx, exerciseIdx, updates, supersetIdx);
              }}
              onClose={() => {
                setEditingExercise(null);
              }}
            />
          );
        })()}

        {/* Edit Block Dialog */}
        {editingBlockIdx !== null && (
          <EditBlockDialog
            open={editingBlockIdx !== null}
            block={workoutWithIds.blocks[editingBlockIdx]}
            workoutSettings={workoutWithIds.settings}
            onSave={(updates: BlockUpdates) => {
              const newWorkout = cloneWorkout(workoutWithIds);
              const block = newWorkout.blocks[editingBlockIdx];

              // Update block label
              if (updates.label !== undefined) {
                block.label = updates.label;
              }

              // Helper to update all exercises in block
              const updateAllExercises = (updateFn: (ex: Exercise) => void) => {
                // Update block-level exercises
                if (block.exercises) {
                  block.exercises.forEach(ex => {
                    if (ex) updateFn(ex);
                  });
                }
                // Update superset exercises
                if (block.supersets) {
                  block.supersets.forEach(ss => {
                    if (ss.exercises) {
                      ss.exercises.forEach(ex => {
                        if (ex) updateFn(ex);
                      });
                    }
                  });
                }
              };

              // Rest override (AMA-96)
              // Store rest override settings at block level
              if (updates.restOverrideEnabled !== undefined) {
                if (updates.restOverrideEnabled) {
                  block.restOverride = {
                    enabled: true,
                    restType: updates.restType,
                    restSec: updates.restSec,
                  };
                  // Also apply to exercises for backward compatibility
                  updateAllExercises(ex => {
                    if (updates.restType !== undefined) {
                      ex.rest_type = updates.restType;
                    }
                    if (updates.restSec !== undefined) {
                      ex.rest_sec = updates.restSec;
                    }
                  });
                } else {
                  // Clear override - exercises will use workout defaults
                  block.restOverride = undefined;
                }
              }

              // Sets: Always apply to all exercises (common bulk operation)
              if (updates.sets !== undefined && updates.sets !== null) {
                updateAllExercises(ex => {
                  ex.sets = updates.sets!;
                });
              }

              // Reps: Only apply if toggle was explicitly enabled
              if (updates.applyReps && updates.reps !== null) {
                updateAllExercises(ex => {
                  ex.reps = updates.reps;
                  // Clear rep range when setting explicit reps
                  ex.reps_range = null;
                });
              }

              // Rep Range: Only apply if toggle was explicitly enabled
              if (updates.applyRepsRange && updates.repsRange !== null) {
                updateAllExercises(ex => {
                  ex.reps_range = updates.repsRange || null;
                  // Clear explicit reps when setting range
                  if (updates.repsRange) {
                    ex.reps = null;
                  }
                });
              }

              // Warm-up configuration (block-level properties)
              block.warmup_enabled = updates.warmupEnabled ?? false;
              if (updates.warmupEnabled) {
                block.warmup_activity = updates.warmupActivity;
                block.warmup_duration_sec = updates.warmupDurationSec ?? null;
              } else {
                block.warmup_activity = undefined;
                block.warmup_duration_sec = null;
              }

              onWorkoutChange(newWorkout);
              setEditingBlockIdx(null);
            }}
            onClose={() => setEditingBlockIdx(null)}
          />
        )}

        {/* Workout Settings Dialog (AMA-96) */}
        <WorkoutSettingsDialog
          open={showWorkoutSettings}
          title={workoutWithIds.title}
          settings={workoutWithIds.settings}
          onSave={handleWorkoutSettingsSave}
          onClose={() => setShowWorkoutSettings(false)}
        />

      </div>
    </DndProvider>
  );
}
