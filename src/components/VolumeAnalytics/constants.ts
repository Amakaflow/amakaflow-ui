/**
 * Muscle group categorizations for volume analytics.
 *
 * Part of AMA-483: Volume Analytics Dashboard
 */

/**
 * Push muscles - primarily used in pushing movements.
 */
export const PUSH_MUSCLES = [
  'chest',
  'anterior_deltoid',
  'triceps',
  'front_delts',
  'pectorals',
];

/**
 * Pull muscles - primarily used in pulling movements.
 */
export const PULL_MUSCLES = [
  'lats',
  'latissimus_dorsi',
  'rhomboids',
  'biceps',
  'posterior_deltoid',
  'rear_delts',
  'middle_back',
  'traps',
  'trapezius',
];

/**
 * Upper body muscles.
 */
export const UPPER_MUSCLES = [
  'chest',
  'pectorals',
  'lats',
  'latissimus_dorsi',
  'shoulders',
  'deltoids',
  'anterior_deltoid',
  'posterior_deltoid',
  'front_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'rhomboids',
  'middle_back',
  'traps',
  'trapezius',
  'neck',
];

/**
 * Lower body muscles.
 */
export const LOWER_MUSCLES = [
  'quadriceps',
  'quads',
  'hamstrings',
  'glutes',
  'gluteus',
  'calves',
  'hip_flexors',
  'adductors',
  'abductors',
];

/**
 * Core muscles.
 */
export const CORE_MUSCLES = [
  'abs',
  'abdominals',
  'obliques',
  'lower_back',
  'erector_spinae',
  'core',
];

/**
 * Mapping of muscle group aliases to canonical names for display.
 */
export const MUSCLE_GROUP_DISPLAY_NAMES: Record<string, string> = {
  chest: 'Chest',
  pectorals: 'Chest',
  lats: 'Lats',
  latissimus_dorsi: 'Lats',
  shoulders: 'Shoulders',
  deltoids: 'Shoulders',
  anterior_deltoid: 'Front Delts',
  posterior_deltoid: 'Rear Delts',
  front_delts: 'Front Delts',
  rear_delts: 'Rear Delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quadriceps: 'Quads',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  gluteus: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
  abdominals: 'Abs',
  obliques: 'Obliques',
  lower_back: 'Lower Back',
  middle_back: 'Middle Back',
  rhomboids: 'Rhomboids',
  traps: 'Traps',
  trapezius: 'Traps',
  core: 'Core',
  hip_flexors: 'Hip Flexors',
  adductors: 'Adductors',
  abductors: 'Abductors',
  neck: 'Neck',
  erector_spinae: 'Lower Back',
};

/**
 * Colors for muscle groups in charts.
 */
export const MUSCLE_GROUP_COLORS: Record<string, string> = {
  chest: '#ef4444',
  lats: '#3b82f6',
  shoulders: '#f59e0b',
  biceps: '#10b981',
  triceps: '#8b5cf6',
  quadriceps: '#ec4899',
  hamstrings: '#14b8a6',
  glutes: '#f97316',
  calves: '#6366f1',
  abs: '#84cc16',
  lower_back: '#0ea5e9',
  middle_back: '#06b6d4',
  traps: '#a855f7',
  forearms: '#22c55e',
  core: '#eab308',
};

/**
 * Format volume with K/M suffixes for compact display.
 */
export function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K`;
  }
  return volume.toLocaleString();
}

/**
 * Get display name for a muscle group.
 */
export function getMuscleGroupDisplayName(muscleGroup: string): string {
  const normalized = muscleGroup.toLowerCase().replace(/\s+/g, '_');
  return MUSCLE_GROUP_DISPLAY_NAMES[normalized] ||
         muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1).replace(/_/g, ' ');
}

/**
 * Get color for a muscle group.
 */
export function getMuscleGroupColor(muscleGroup: string): string {
  const normalized = muscleGroup.toLowerCase().replace(/\s+/g, '_');
  // Map common aliases to their canonical color
  const colorKey =
    normalized.includes('chest') || normalized.includes('pectoral') ? 'chest' :
    normalized.includes('lat') ? 'lats' :
    normalized.includes('shoulder') || normalized.includes('delt') ? 'shoulders' :
    normalized.includes('bicep') ? 'biceps' :
    normalized.includes('tricep') ? 'triceps' :
    normalized.includes('quad') ? 'quadriceps' :
    normalized.includes('hamstring') ? 'hamstrings' :
    normalized.includes('glute') ? 'glutes' :
    normalized.includes('calf') || normalized.includes('calve') ? 'calves' :
    normalized.includes('ab') || normalized.includes('core') ? 'abs' :
    normalized.includes('lower_back') || normalized.includes('erector') ? 'lower_back' :
    normalized.includes('trap') ? 'traps' :
    normalized.includes('forearm') ? 'forearms' :
    normalized;

  return MUSCLE_GROUP_COLORS[colorKey] || '#64748b';
}

/**
 * Check if a muscle group is a push muscle.
 * Uses substring matching to handle variations (e.g., "chest_muscles" matches "chest").
 */
export function isPushMuscle(muscleGroup: string): boolean {
  const normalized = muscleGroup.toLowerCase().replace(/\s+/g, '_');
  return PUSH_MUSCLES.some(m => normalized.includes(m));
}

/**
 * Check if a muscle group is a pull muscle.
 * Uses substring matching to handle variations.
 */
export function isPullMuscle(muscleGroup: string): boolean {
  const normalized = muscleGroup.toLowerCase().replace(/\s+/g, '_');
  return PULL_MUSCLES.some(m => normalized.includes(m));
}

/**
 * Check if a muscle group is an upper body muscle.
 * Uses substring matching to handle variations.
 */
export function isUpperMuscle(muscleGroup: string): boolean {
  const normalized = muscleGroup.toLowerCase().replace(/\s+/g, '_');
  return UPPER_MUSCLES.some(m => normalized.includes(m));
}

/**
 * Check if a muscle group is a lower body muscle.
 * Uses substring matching to handle variations.
 */
export function isLowerMuscle(muscleGroup: string): boolean {
  const normalized = muscleGroup.toLowerCase().replace(/\s+/g, '_');
  return LOWER_MUSCLES.some(m => normalized.includes(m));
}
