/**
 * Zod schemas for the mapper-api pipeline layer.
 *
 * These schemas validate the shape returned by POST /validate, which is
 * the lighter-weight pipeline contract (success/matches/unmapped) used
 * by runIngestionPipeline — not the full ValidationResponse used by the
 * mapper-api's /workflow/validate endpoint.
 *
 * Shapes here match the IngestionValidation interface in
 * src/api/pipelines/ingestion.ts.
 */

import { z } from 'zod';

// A single exercise match result from the mapper /validate endpoint.
export const ExerciseMatchSchema = z.object({
  original_name: z.string(),
  matched_name: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  garmin_id: z.string().nullable(),
});

// The full /validate response as consumed by the pipeline layer.
export const ValidationResponseSchema = z.object({
  success: z.boolean(),
  matches: z.array(ExerciseMatchSchema),
  unmapped: z.array(z.string()),
});
