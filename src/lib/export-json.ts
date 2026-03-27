/**
 * AMA-118: Client-side JSON export for workouts.
 *
 * Generates structured JSON files from WorkoutStructure data
 * that can be reimported or shared with other tools.
 */

import type { WorkoutStructure } from '../types/workout';

/** Version of the JSON export schema */
const EXPORT_SCHEMA_VERSION = '1.0.0';

/**
 * Metadata attached to exported JSON files
 */
export interface ExportMetadata {
  exportedAt: string;
  schemaVersion: string;
  source: string;
  workoutCount: number;
}

/**
 * Envelope for single workout JSON export
 */
export interface WorkoutJsonExport {
  metadata: ExportMetadata;
  workout: WorkoutStructure;
}

/**
 * Envelope for bulk workout JSON export
 */
export interface BulkWorkoutJsonExport {
  metadata: ExportMetadata;
  workouts: WorkoutStructure[];
}

/**
 * Build export metadata
 */
function buildMetadata(count: number): ExportMetadata {
  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: EXPORT_SCHEMA_VERSION,
    source: 'AmakaFlow',
    workoutCount: count,
  };
}

/**
 * Strip internal/transient fields from a workout before export.
 * Removes fields prefixed with _ (like _bulkWorkouts, _provenance).
 */
function sanitizeWorkout(workout: WorkoutStructure): WorkoutStructure {
  const { _bulkWorkouts, _provenance, ...clean } = workout;
  return clean;
}

/**
 * Generate a JSON export object for a single workout.
 *
 * @param workout - The workout structure to export
 * @returns The export envelope with metadata
 */
export function generateJsonExport(workout: WorkoutStructure): WorkoutJsonExport {
  return {
    metadata: buildMetadata(1),
    workout: sanitizeWorkout(workout),
  };
}

/**
 * Generate a JSON export object for multiple workouts.
 *
 * @param workouts - Array of workout structures
 * @returns The bulk export envelope with metadata
 */
export function generateBulkJsonExport(workouts: WorkoutStructure[]): BulkWorkoutJsonExport {
  return {
    metadata: buildMetadata(workouts.length),
    workouts: workouts.map(sanitizeWorkout),
  };
}

/**
 * Serialize workout to a formatted JSON string.
 *
 * @param workout - The workout structure
 * @param pretty - Whether to pretty-print (default true)
 * @returns JSON string
 */
export function workoutToJsonString(workout: WorkoutStructure, pretty = true): string {
  const exportObj = generateJsonExport(workout);
  return JSON.stringify(exportObj, null, pretty ? 2 : undefined);
}

/**
 * Serialize multiple workouts to a formatted JSON string.
 *
 * @param workouts - Array of workout structures
 * @param pretty - Whether to pretty-print (default true)
 * @returns JSON string
 */
export function workoutsToJsonString(workouts: WorkoutStructure[], pretty = true): string {
  const exportObj = generateBulkJsonExport(workouts);
  return JSON.stringify(exportObj, null, pretty ? 2 : undefined);
}

/**
 * Download a single workout as a JSON file.
 *
 * @param workout - The workout structure to export
 * @param filename - Optional filename (without extension)
 */
export function downloadWorkoutJson(workout: WorkoutStructure, filename?: string): void {
  const jsonStr = workoutToJsonString(workout);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const name = filename ?? workout.title.replace(/\s+/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download multiple workouts as a single JSON file.
 *
 * @param workouts - Array of workout structures
 * @param filename - Optional filename (without extension)
 */
export function downloadBulkWorkoutJson(workouts: WorkoutStructure[], filename?: string): void {
  const jsonStr = workoutsToJsonString(workouts);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const name = filename ?? `workouts_${new Date().toISOString().split('T')[0]}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
