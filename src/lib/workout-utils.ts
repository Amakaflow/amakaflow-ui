import { Block, Exercise, WorkoutStructure, Superset, ValidationResponse, WorkoutStructureType, WarmupActivity } from '../types/workout';

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
      settings: workout?.settings,
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
        id: superset.id || generateId(),
        exercises: (superset.exercises || []).filter(ex => ex != null).map(exercise => ({
          ...exercise,
          id: exercise.id || generateId(),
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
  if (!structure) return 'BLOCK';
  const MAP: Record<string, string> = {
    'warmup': 'WARM-UP',
    'cooldown': 'COOLDOWN',
    'for-time': 'FOR TIME',
    'emom': 'EMOM',
    'amrap': 'AMRAP',
    'hiit': 'HIIT',
  };
  return MAP[structure] ?? structure.toUpperCase();
}

/** Format seconds into human-readable rest label. */
export function formatRestSecs(sec: number): string {
  if (sec <= 90) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/** Format seconds as MM:SS string. */
export function formatMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Return the key metric string shown in a block's header. */
export function getBlockKeyMetric(block: Block): string {
  switch (block.structure) {
    case 'circuit':
    case 'rounds': {
      const parts: string[] = [];
      if (block.rounds) parts.push(`${block.rounds} rnds`);
      if (block.rest_between_rounds_sec) parts.push(`${formatRestSecs(block.rest_between_rounds_sec)} rest`);
      return parts.length ? parts.join(' · ') : 'Configure →';
    }
    case 'emom': {
      const mins = block.time_cap_sec ? Math.floor(block.time_cap_sec / 60) : block.rounds ?? null;
      const workSec = block.time_work_sec;
      if (mins && workSec) return `${mins} min · ${workSec}s/station`;
      if (mins) return `${mins} min`;
      return 'Configure →';
    }
    case 'amrap':
      return block.time_cap_sec ? `Cap: ${formatMMSS(block.time_cap_sec)}` : 'Configure →';
    case 'for-time':
      return block.time_cap_sec ? `Cap: ${formatMMSS(block.time_cap_sec)}` : 'For Time';
    case 'tabata': {
      const parts: string[] = [];
      if (block.time_work_sec) parts.push(`${block.time_work_sec}s on`);
      if (block.time_rest_sec) parts.push(`${block.time_rest_sec}s off`);
      if (block.rounds) parts.push(`${block.rounds} rnds`);
      return parts.length ? parts.join(' · ') : 'Configure →';
    }
    case 'sets':
    case 'regular': {
      const parts: string[] = [];
      if (block.sets) parts.push(`${block.sets} sets`);
      if (block.rest_between_sets_sec) parts.push(`${formatRestSecs(block.rest_between_sets_sec)} rest`);
      return parts.length ? parts.join(' · ') : 'Configure →';
    }
    case 'superset': {
      const parts: string[] = [];
      if (block.rounds) parts.push(`${block.rounds} rnds`);
      if (block.rest_between_rounds_sec) parts.push(`${formatRestSecs(block.rest_between_rounds_sec)} rest`);
      return parts.length ? parts.join(' · ') : 'Configure →';
    }
    case 'warmup':
    case 'cooldown': {
      const parts: string[] = [];
      if (block.warmup_duration_sec) {
        const m = Math.floor(block.warmup_duration_sec / 60);
        const s = block.warmup_duration_sec % 60;
        parts.push(s > 0 ? `${m}m ${s}s` : `${m} min`);
      }
      if (block.warmup_activity) parts.push(block.warmup_activity.replace(/_/g, ' '));
      return parts.length ? parts.join(' · ') : 'Configure →';
    }
    default:
      return '';
  }
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
    case 'warmup':
    case 'cooldown':
      return {
        warmup_duration_sec: 300,
        warmup_activity: 'stretching' as WarmupActivity,
        rounds: null,
        sets: null,
        time_work_sec: null,
        time_rest_sec: null,
        time_cap_sec: null,
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
  
  // Per-exercise rest_sec intentionally not shown in block editor view —
  // block-level rest config (rest_between_rounds_sec etc.) is used instead.
  
  // Type
  if (exercise.type) {
    parts.push(`(${exercise.type})`);
  }
  
  return parts.join(' • ');
}

/**
 * Apply validation mappings to workout exercise names.
 *
 * When a user confirms Garmin mappings (e.g., "Ski" -> "Ski Moguls"),
 * those mappings are stored in the validation object. When exporting
 * to FIT, we need to use the mapped_to names so the backend doesn't
 * re-lookup and potentially change the user's selections.
 *
 * Uses NAME-BASED mapping: all exercises with the same original_name
 * get the same mapped_to value. This handles workouts with repeated
 * exercises (like 5 rounds of the same exercises).
 *
 * IMPORTANT: If the workout already has a user-confirmed Garmin name
 * (Title Case), we preserve it instead of applying potentially stale
 * mappings from validation. This handles cases where the workout was
 * edited after validation.
 *
 * @param workout - The workout structure with original exercise names
 * @param validation - The validation response with mapped_to values
 * @returns A new workout with exercise names replaced by their mapped_to values
 */
export function applyValidationMappings(
  workout: WorkoutStructure,
  validation?: ValidationResponse | null
): WorkoutStructure {
  if (!validation || !workout?.blocks) {
    return workout;
  }

  // Build a lookup map from original_name -> mapped_to name
  // This ensures ALL exercises with the same name get the same mapping
  const mappingsByName = new Map<string, string>();

  // Include all validated exercises (they have confirmed mapped_to values)
  for (const result of validation.validated_exercises || []) {
    if (result.mapped_to && result.original_name) {
      // Use original_name as key so all instances get the same mapping
      mappingsByName.set(result.original_name, result.mapped_to);
    }
  }

  // Also include needs_review items that have a mapped_to value
  // (even if not confirmed, we want to preserve any existing mapping)
  for (const result of validation.needs_review || []) {
    if (result.mapped_to && result.original_name && !mappingsByName.has(result.original_name)) {
      mappingsByName.set(result.original_name, result.mapped_to);
    }
  }

  if (mappingsByName.size === 0) {
    return workout;
  }

  // Helper to check if name is already a user-confirmed Garmin name
  const isUserConfirmedName = (name: string): boolean => {
    if (!name || name.length < 2) return false;
    // Check for distance prefix (e.g., "500m Run")
    if (/^[\d.]+\s*(m|km|mi)\s+/i.test(name)) return false;
    // Check for rep/set counts (e.g., "Push Up x10")
    if (/\s*\d*x\d+/i.test(name)) return false;
    // Check if it looks like Title Case
    const words = name.split(/\s+/);
    if (words.length === 0) return false;
    const capitalized = words.filter((w) => w.length > 0 && w[0] === w[0].toUpperCase()).length;
    return capitalized >= words.length * 0.6;
  };

  // Deep clone and apply mappings by exercise name
  // BUT: If the current name is already a user-confirmed Garmin name, preserve it
  return {
    ...workout,
    blocks: workout.blocks.map((block) => ({
      ...block,
      exercises: (block.exercises || []).map((exercise) => {
        // If current name is already a user-confirmed Garmin name, preserve it
        if (isUserConfirmedName(exercise.name)) {
          return exercise;
        }
        const mappedName = mappingsByName.get(exercise.name);
        return mappedName ? { ...exercise, name: mappedName } : exercise;
      }),
      supersets: (block.supersets || []).map((superset) => ({
        ...superset,
        exercises: (superset.exercises || []).map((exercise) => {
          // If current name is already a user-confirmed Garmin name, preserve it
          if (isUserConfirmedName(exercise.name)) {
            return exercise;
          }
          const mappedName = mappingsByName.get(exercise.name);
          return mappedName ? { ...exercise, name: mappedName } : exercise;
        }),
      })),
    })),
  };
}
