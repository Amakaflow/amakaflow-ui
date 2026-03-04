/**
 * Zod schemas for the workout-ingestor-api pipeline layer.
 *
 * These schemas validate the shape of API responses returned by
 * the ingestor service as consumed by runIngestionPipeline.
 *
 * The shapes here intentionally match IngestionWorkout / IngestionValidation
 * in src/api/pipelines/ingestion.ts — if those interfaces drift from what
 * the real API returns, the fixture tests will catch it at CI time.
 */

import { z } from 'zod';

// An individual exercise within a block (pipeline-layer view: minimal required fields).
// Uses the pipeline's IngestionWorkout shape, not the full client-side Exercise type.
export const IngestorExerciseSchema = z.object({
  name: z.string(),
  sets: z.number().nullable().optional(),
  reps: z.number().nullable().optional(),
  duration_sec: z.number().nullable().optional(),
  rest_sec: z.number().nullable().optional(),
  weight_kg: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
}).passthrough(); // allow extra fields from the API

// A workout block (pipeline-layer view).
export const IngestorBlockSchema = z.object({
  label: z.string(),
  structure: z.string().nullable().optional(),
  exercises: z.array(IngestorExerciseSchema).default([]),
}).passthrough();

// The top-level workout structure returned by /ingest/* endpoints.
export const WorkoutStructureSchema = z.object({
  title: z.string(),
  blocks: z.array(IngestorBlockSchema).default([]),
  source: z.string().optional(),
  workout_type: z.string().nullable().optional(),
  workout_type_confidence: z.number().min(0).max(1).nullable().optional(),
}).passthrough();
