/**
 * Ingestor API client — typed, validated.
 * Wraps src/lib/api.ts functions with Zod validation.
 * The heavy ingest logic stays in api.ts for now (complex multipart handling).
 * This client is the validated entry point for new call sites.
 */
import { WorkoutStructureResponseSchema } from '../schemas/ingestor';
import type { WorkoutStructure } from '../../types/workout';
import { generateWorkoutStructure as _generateWorkoutStructure, createEmptyWorkout as _createEmptyWorkout, checkApiHealth } from '../../lib/api';
import { normalizeWorkoutStructure } from '../../lib/api';

export { normalizeWorkoutStructure, checkApiHealth };

export async function generateWorkoutStructure(
  sources: Array<{ type: string; content: string }>,
  signal?: AbortSignal
): Promise<WorkoutStructure> {
  const workout = await _generateWorkoutStructure(sources as any, signal);
  // Validate shape at boundary — throws ZodError with field detail if shape is wrong
  WorkoutStructureResponseSchema.parse(workout);
  return workout;
}

export async function createEmptyWorkout(): Promise<WorkoutStructure> {
  const workout = await _createEmptyWorkout();
  return workout;
}
