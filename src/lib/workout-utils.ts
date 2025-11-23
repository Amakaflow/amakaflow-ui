import { Block, Exercise, WorkoutStructure } from '../types/workout';

/**
 * Generate a unique ID for blocks and exercises
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add IDs to all blocks and exercises in a workout
 */
export function addIdsToWorkout(workout: WorkoutStructure): WorkoutStructure {
  // Guard against undefined/null workout or blocks
  if (!workout || !workout.blocks || !Array.isArray(workout.blocks)) {
    return {
      title: workout?.title || '',
      source: workout?.source || '',
      blocks: []
    };
  }
  
  return {
    ...workout,
    blocks: workout.blocks.map(block => ({
      ...block,
      id: block.id || generateId(),
      exercises: (block.exercises || []).map(exercise => ({
        ...exercise,
        id: exercise.id || generateId(),
      })),
    })),
  };
}

/**
 * Clone a block with a new ID (for drag-and-drop from library)
 */
export function cloneBlock(block: Block): Block {
  return {
    ...block,
    id: generateId(),
    exercises: (block.exercises || []).map(exercise => ({
      ...exercise,
      id: generateId(),
    })),
  };
}

/**
 * Get structure display name
 */
export function getStructureDisplayName(structure: string | null): string {
  if (!structure) return 'Single';
  return structure.toUpperCase();
}

/**
 * Get block summary text
 */
export function getBlockSummary(block: Block): string {
  const parts: string[] = [];
  
  if (block.structure === 'superset') {
    if (block.rounds) parts.push(`${block.rounds} rounds`);
    if (block.rest_between_rounds_sec) parts.push(`${block.rest_between_rounds_sec}s rest`);
  } else if (block.structure === 'circuit') {
    if (block.rounds) parts.push(`${block.rounds} rounds`);
    if (block.rest_between_rounds_sec) parts.push(`${block.rest_between_rounds_sec}s rest`);
  } else if (block.structure === 'tabata') {
    if (block.time_work_sec && block.time_rest_sec) {
      parts.push(`${block.time_work_sec}:${block.time_rest_sec}`);
    }
    if (block.rounds) parts.push(`x ${block.rounds}`);
  } else if (block.structure === 'emom') {
    if (block.time_work_sec) parts.push(`${block.time_work_sec}s work`);
    if (block.rounds) parts.push(`${block.rounds} min`);
  } else if (block.structure === 'amrap') {
    if (block.time_cap_sec) {
      const minutes = Math.floor(block.time_cap_sec / 60);
      parts.push(`${minutes}:${String(block.time_cap_sec % 60).padStart(2, '0')} AMRAP`);
    }
  } else if (block.structure === 'for-time') {
    if (block.rounds) parts.push(`${block.rounds} rounds`);
    if (block.time_cap_sec) {
      const minutes = Math.floor(block.time_cap_sec / 60);
      parts.push(`${minutes}:${String(block.time_cap_sec % 60).padStart(2, '0')} cap`);
    }
  } else if (block.structure === 'rounds') {
    if (block.rounds) parts.push(`${block.rounds} rounds`);
    if (block.rest_between_rounds_sec) parts.push(`${block.rest_between_rounds_sec}s rest`);
  } else if (block.structure === 'sets') {
    if (block.sets) parts.push(`${block.sets} sets`);
    if (block.rest_between_sets_sec) parts.push(`${block.rest_between_sets_sec}s rest`);
  }
  
  const exerciseCount = (block.exercises || []).length;
  return parts.length > 0 ? parts.join(' • ') : `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`;
}

/**
 * Get structure-specific default values when switching structures
 */
export function getStructureDefaults(structure: WorkoutStructureType | null): Partial<Block> {
  switch (structure) {
    case 'tabata':
      return {
        rounds: 8,
        time_work_sec: 20,
        time_rest_sec: 10,
        time_cap_sec: null,
        sets: null,
        rest_between_rounds_sec: null,
        rest_between_sets_sec: null,
      };
    case 'emom':
      return {
        time_work_sec: 30,
        rounds: 10,
        time_rest_sec: null,
        time_cap_sec: null,
        sets: null,
        rest_between_rounds_sec: null,
        rest_between_sets_sec: null,
      };
    case 'amrap':
      return {
        time_cap_sec: 600, // 10 minutes default
        rest_between_rounds_sec: 0,
        time_work_sec: null,
        time_rest_sec: null,
        rounds: null,
        sets: null,
        rest_between_sets_sec: null,
      };
    case 'for-time':
      return {
        time_cap_sec: 1800, // 30 minutes default
        rounds: null,
        time_work_sec: null,
        time_rest_sec: null,
        sets: null,
        rest_between_rounds_sec: null,
        rest_between_sets_sec: null,
      };
    case 'superset':
      return {
        rest_between_rounds_sec: 60,
        rounds: null,
        time_work_sec: null,
        time_rest_sec: null,
        time_cap_sec: null,
        sets: null,
        rest_between_sets_sec: null,
      };
    case 'circuit':
      return {
        rest_between_rounds_sec: 90,
        rounds: null,
        time_work_sec: null,
        time_rest_sec: null,
        time_cap_sec: null,
        sets: null,
        rest_between_sets_sec: null,
      };
    case 'rounds':
      return {
        rounds: 3,
        rest_between_rounds_sec: 60,
        time_work_sec: null,
        time_rest_sec: null,
        time_cap_sec: null,
        sets: null,
        rest_between_sets_sec: null,
      };
    case 'sets':
      return {
        sets: 4,
        rest_between_sets_sec: 120,
        time_work_sec: null,
        time_rest_sec: null,
        time_cap_sec: null,
        rounds: null,
        rest_between_rounds_sec: null,
      };
    case 'regular':
      return {
        time_work_sec: null,
        time_rest_sec: null,
        time_cap_sec: null,
        rounds: null,
        sets: null,
        rest_between_rounds_sec: null,
        rest_between_sets_sec: null,
      };
    default:
      return {
        time_work_sec: null,
        time_rest_sec: null,
        time_cap_sec: null,
        rounds: null,
        sets: null,
        rest_between_rounds_sec: null,
        rest_between_sets_sec: null,
      };
  }
}


