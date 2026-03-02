import { useState, useMemo } from 'react';
import {
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type {
  WorkoutStructure,
  Exercise,
  Block,
  Superset,
  WorkoutSettings,
  WorkoutStructureType,
} from '../../../types/workout';
import {
  addIdsToWorkout,
  generateId,
  getStructureDisplayName,
  getStructureDefaults,
} from '../../../lib/workout-utils';

// ── @dnd-kit drag data shapes ─────────────────────────────────────────────────
type DraggableData =
  | { type: 'block'; blockIdx: number }
  | { type: 'exercise'; blockIdx: number; exerciseIdx: number; supersetIdx: null }
  | { type: 'superset-exercise'; blockIdx: number; supersetIdx: number; exerciseIdx: number };

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

// ── Hook interface ────────────────────────────────────────────────────────────
export interface UseStructureWorkoutProps {
  workout: WorkoutStructure;
  onWorkoutChange: (w: WorkoutStructure) => void;
}

export function useStructureWorkout({
  workout,
  onWorkoutChange,
}: UseStructureWorkoutProps) {
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
    // Include block structural config fields (rounds, rest, time caps, etc.)
    workout?.blocks?.map(b =>
      `${b?.structure ?? ''}|${b?.rounds ?? ''}|${b?.rest_between_rounds_sec ?? ''}|${b?.rest_between_sets_sec ?? ''}|${b?.time_cap_sec ?? ''}|${b?.time_work_sec ?? ''}|${b?.time_rest_sec ?? ''}|${b?.sets ?? ''}|${b?.warmup_duration_sec ?? ''}|${b?.warmup_activity ?? ''}`
    ).join('^^') ?? '',
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
  const [showAddBlockPicker, setShowAddBlockPicker] = useState(false);
  const [skippedWarmup, setSkippedWarmup] = useState(false);
  const [skippedCooldown, setSkippedCooldown] = useState(false);
  const [skippedRest, setSkippedRest] = useState(false);

  // Active drag item for DragOverlay ghost preview
  const [activeDragItem, setActiveDragItem] = useState<{
    type: 'block' | 'exercise' | 'superset-exercise';
    label: string;
  } | null>(null);

  // ── Drag start: record active item for DragOverlay ───────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DraggableData | undefined;
    if (!data) return;

    if (data.type === 'block') {
      const block = workoutWithIds.blocks[data.blockIdx];
      setActiveDragItem({ type: 'block', label: block?.label ?? 'Block' });
    } else if (data.type === 'exercise') {
      const exercise = workoutWithIds.blocks[data.blockIdx]?.exercises?.[data.exerciseIdx];
      setActiveDragItem({ type: 'exercise', label: exercise?.name ?? 'Exercise' });
    } else if (data.type === 'superset-exercise') {
      const exercise = workoutWithIds.blocks[data.blockIdx]?.supersets?.[data.supersetIdx]?.exercises?.[data.exerciseIdx];
      setActiveDragItem({ type: 'superset-exercise', label: exercise?.name ?? 'Exercise' });
    }
  };

  // ── Drag end: single unified handler for blocks and exercises ─────────────
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current as DraggableData | undefined;
    if (!activeData) return;

    const newWorkout = cloneWorkout(workoutWithIds);

    if (activeData.type === 'block') {
      const oldIdx = newWorkout.blocks.findIndex(b => b.id === String(active.id));
      const newIdx = newWorkout.blocks.findIndex(b => b.id === String(over.id));
      if (oldIdx !== -1 && newIdx !== -1) {
        newWorkout.blocks = arrayMove(newWorkout.blocks, oldIdx, newIdx);
        onWorkoutChange(newWorkout);
      }
      return;
    }

    if (activeData.type === 'exercise') {
      const block = newWorkout.blocks[activeData.blockIdx];
      if (!block?.exercises) return;
      const oldIdx = block.exercises.findIndex(e => e?.id === String(active.id));
      const newIdx = block.exercises.findIndex(e => e?.id === String(over.id));
      if (oldIdx !== -1 && newIdx !== -1) {
        block.exercises = arrayMove(block.exercises, oldIdx, newIdx);
        onWorkoutChange(newWorkout);
      }
      return;
    }

    if (activeData.type === 'superset-exercise') {
      const superset = newWorkout.blocks[activeData.blockIdx]?.supersets?.[activeData.supersetIdx];
      if (!superset?.exercises) return;
      const oldIdx = superset.exercises.findIndex(e => e?.id === String(active.id));
      const newIdx = superset.exercises.findIndex(e => e?.id === String(over.id));
      if (oldIdx !== -1 && newIdx !== -1) {
        superset.exercises = arrayMove(superset.exercises, oldIdx, newIdx);
        onWorkoutChange(newWorkout);
      }
      return;
    }
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

  const addBlock = (structure?: WorkoutStructureType) => {
    const newWorkout = cloneWorkout(workoutWithIds);
    const defaults = structure ? getStructureDefaults(structure) : {};
    const displayName = structure ? getStructureDisplayName(structure) : null;
    const label = displayName
      ? displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase()
      : `Block ${(workoutWithIds.blocks || []).length + 1}`;
    const newBlock: Block = {
      id: generateId(),
      label,
      structure: structure ?? null,
      exercises: [],
      ...defaults,
    };
    newWorkout.blocks.push(newBlock);
    onWorkoutChange(newWorkout);
    setShowAddBlockPicker(false);
  };

  const updateBlock = (blockIdx: number, updates: Partial<Block>) => {
    const newWorkout = cloneWorkout(workoutWithIds);
    newWorkout.blocks[blockIdx] = { ...newWorkout.blocks[blockIdx], ...updates };
    onWorkoutChange(newWorkout);
  };

  // AMA-731: Delete a block from the workout
  const deleteBlock = (blockIdx: number) => {
    const newWorkout = cloneWorkout(workoutWithIds);
    if (newWorkout.blocks[blockIdx]) {
      newWorkout.blocks.splice(blockIdx, 1);
    }
    onWorkoutChange(newWorkout);
  };

  // Handle workout-level settings changes (AMA-96)
  const handleWorkoutSettingsSave = (title: string, settings: WorkoutSettings) => {
    const newWorkout = cloneWorkout(workoutWithIds);
    newWorkout.title = title;
    newWorkout.settings = settings;
    onWorkoutChange(newWorkout);
  };

  const addWarmupBlock = () => {
    const newWorkout = cloneWorkout(workoutWithIds);
    const warmupBlock: Block = {
      id: generateId(),
      label: 'Warm-up',
      structure: 'warmup',
      exercises: [],
      warmup_enabled: true,
      ...getStructureDefaults('warmup'),
    };
    newWorkout.blocks.unshift(warmupBlock);
    onWorkoutChange(newWorkout);
  };

  return {
    // Derived workout with IDs
    workoutWithIds,

    // State
    showWorkoutSettings,
    setShowWorkoutSettings,
    editingExercise,
    setEditingExercise,
    editingBlockIdx,
    setEditingBlockIdx,
    showExerciseSearch,
    setShowExerciseSearch,
    addingToBlock,
    setAddingToBlock,
    addingToSuperset,
    setAddingToSuperset,
    collapseSignal,
    setCollapseSignal,
    jsonCopied,
    setJsonCopied,
    showAddBlockPicker,
    setShowAddBlockPicker,
    skippedWarmup,
    setSkippedWarmup,
    skippedCooldown,
    setSkippedCooldown,
    skippedRest,
    setSkippedRest,
    activeDragItem,
    setActiveDragItem,

    // Handlers
    handleDragStart,
    handleDragEnd,
    updateExercise,
    deleteExercise,
    addExercise,
    addSuperset,
    deleteSuperset,
    addBlock,
    updateBlock,
    deleteBlock,
    handleWorkoutSettingsSave,
    addWarmupBlock,
  };
}
