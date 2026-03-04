import { z } from 'zod';

// === Client-layer schemas (full API response shapes for the ingestor service) ===

export const ExerciseSchema = z.object({
  name: z.string(),
  sets: z.number().nullable().optional(),
  reps: z.number().nullable().optional(),
  reps_range: z.string().nullable().optional(),
  duration_sec: z.number().nullable().optional(),
  rest_sec: z.number().nullable().optional(),
  distance_m: z.number().nullable().optional(),
  type: z.string().optional(),
});

export const SupersetSchema = z.object({
  exercises: z.array(ExerciseSchema),
  rest_between_sec: z.number().nullable().optional(),
});

export const BlockSchema = z.object({
  label: z.string().optional(),
  structure: z.string().nullable().optional(),
  exercises: z.array(ExerciseSchema),
  supersets: z.array(SupersetSchema).optional(),
  sets: z.number().nullable().optional(),
  rounds: z.number().nullable().optional(),
  rest_between_sets_sec: z.number().nullable().optional(),
  rest_between_rounds_sec: z.number().nullable().optional(),
  time_cap_sec: z.number().nullable().optional(),
});

export const WorkoutStructureResponseSchema = z.object({
  title: z.string().optional(),
  source: z.string().optional(),
  blocks: z.array(BlockSchema),
  workout_type: z.string().optional(),
  workout_type_confidence: z.number().optional(),
});

// === Pipeline-layer schemas (minimal shapes for runIngestionPipeline) ===
//
// These validate the shape of API responses returned by the ingestor service
// as consumed by runIngestionPipeline. Shapes match IngestionWorkout in
// src/api/pipelines/ingestion.ts. If those interfaces drift from the real
// API response, the fixture tests will catch it at CI time.

// An individual exercise within a block (pipeline-layer view: minimal required fields).
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
