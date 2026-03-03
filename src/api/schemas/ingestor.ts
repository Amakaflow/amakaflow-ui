import { z } from 'zod';

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
