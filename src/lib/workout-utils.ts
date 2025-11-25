import { Block, Exercise, WorkoutStructure, Superset } from '../types/workout';

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
  
  // Industry-standard: ensure all exercises and supersets have required IDs
  return {
    ...workout,
    blocks: workout.blocks.map(block => ({
      ...block,
      id: block.id || generateId(),
      exercises: (block.exercises || []).filter(ex => ex != null).map(exercise => ({
        ...exercise,
        id: exercise.id || generateId(), // Required field
      })),
      supersets: (block.supersets || []).map(superset => ({
        ...superset,
        id: superset.id || generateId(), // Required field
        exercises: (superset.exercises || []).filter(ex => ex != null).map(exercise => ({
          ...exercise,
          id: exercise.id || generateId(), // Required field
        })),
      })),
    })),
  };
}

/**
 * Create an empty workout structure for manual creation
 */
export function createEmptyWorkout(): WorkoutStructure {
  return addIdsToWorkout({
    title: "New Workout",
    source: "manual",
    blocks: [
      {
        label: "Workout",
        structure: null,
        exercises: [],
        supersets: [],
        rounds: null,
        sets: null,
        time_cap_sec: null,
        time_work_sec: null,
        time_rest_sec: null,
        rest_between_rounds_sec: null,
        rest_between_sets_sec: null
      }
    ]
  });
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
    supersets: (block.supersets || []).map(superset => ({
      ...superset,
      id: generateId(),
      exercises: (superset.exercises || []).map(exercise => ({
        ...exercise,
        id: generateId(),
      })),
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
  
  // Count exercises from both block-level and supersets
  const blockExercises = (block.exercises || []).length;
  const supersetExercises = (block.supersets || []).reduce(
    (sum, ss) => sum + (ss.exercises?.length || 0),
    0
  );
  const totalExerciseCount = blockExercises + supersetExercises;
  return parts.length > 0 ? parts.join(' • ') : `${totalExerciseCount} exercise${totalExerciseCount !== 1 ? 's' : ''}`;
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

/**
 * Format workout structure as text description for Strava
 */
export function formatWorkoutForStrava(workout: WorkoutStructure): string {
  if (!workout || !workout.blocks || workout.blocks.length === 0) {
    return workout?.title || 'Workout';
  }

  const lines: string[] = [];
  
  // Add title if available
  if (workout.title) {
    lines.push(workout.title);
    lines.push('');
  }

  // Format each block
  workout.blocks.forEach((block, blockIdx) => {
    const blockLabel = block.label || block.name || block.type || `Block ${blockIdx + 1}`;
    lines.push(`${blockLabel}:`);
    
    // Block-level exercises
    if (block.exercises && block.exercises.length > 0) {
      block.exercises.forEach((exercise, exerciseIdx) => {
        const exerciseLine = formatExerciseForStrava(exercise, exerciseIdx);
        if (exerciseLine) {
          lines.push(`  ${exerciseLine}`);
        }
      });
    }
    
    // Superset exercises
    if (block.supersets && block.supersets.length > 0) {
      block.supersets.forEach((superset, supersetIdx) => {
        lines.push(`  Superset ${supersetIdx + 1}:`);
        if (superset.exercises && superset.exercises.length > 0) {
          superset.exercises.forEach((exercise, exerciseIdx) => {
            const exerciseLine = formatExerciseForStrava(exercise, exerciseIdx, true);
            if (exerciseLine) {
              lines.push(`    ${String.fromCharCode(65 + exerciseIdx)}. ${exerciseLine}`);
            }
          });
        }
      });
    }
    
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format a single exercise for Strava description
 */
function formatExerciseForStrava(exercise: Exercise, index: number, inSuperset: boolean = false): string {
  const parts: string[] = [];
  
  // Exercise name
  parts.push(exercise.name || `Exercise ${index + 1}`);
  
  // Sets
  if (exercise.sets) {
    parts.push(`${exercise.sets} sets`);
  }
  
  // Reps
  if (exercise.reps) {
    parts.push(`${exercise.reps} reps`);
  } else if (exercise.reps_range) {
    parts.push(`${exercise.reps_range} reps`);
  }
  
  // Duration
  if (exercise.duration_sec) {
    const minutes = Math.floor(exercise.duration_sec / 60);
    const seconds = exercise.duration_sec % 60;
    if (minutes > 0) {
      parts.push(`${minutes}m ${seconds}s`);
    } else {
      parts.push(`${seconds}s`);
    }
  }
  
  // Distance
  if (exercise.distance_m) {
    if (exercise.distance_m >= 1000) {
      parts.push(`${(exercise.distance_m / 1000).toFixed(2)}km`);
    } else {
      parts.push(`${exercise.distance_m}m`);
    }
  } else if (exercise.distance_range) {
    parts.push(exercise.distance_range);
  }
  
  // Rest
  if (exercise.rest_sec) {
    parts.push(`${exercise.rest_sec}s rest`);
  }
  
  // Type
  if (exercise.type) {
    parts.push(`(${exercise.type})`);
  }
  
  return parts.join(' • ');
}


