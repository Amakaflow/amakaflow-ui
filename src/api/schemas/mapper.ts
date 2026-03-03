import { z } from 'zod';
import type { SavedWorkout, WorkoutProgram, UserTag } from '../generated/mapper';

const SyncStatusEntrySchema = z.object({
  status: z.string(),
  queued_at: z.string().optional(),
  synced_at: z.string().optional(),
  failed_at: z.string().optional(),
  error_message: z.string().optional(),
});

export const SavedWorkoutSchema = z.object({
  id: z.string(),
  profile_id: z.string(),
  workout_data: z.record(z.unknown()),
  sources: z.array(z.string()),
  device: z.string(),
  exports: z.record(z.unknown()).optional(),
  validation: z.record(z.unknown()).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  is_exported: z.boolean(),
  exported_at: z.string().optional(),
  exported_to_device: z.string().optional(),
  synced_to_strava: z.boolean().optional(),
  strava_activity_id: z.string().optional(),
  ios_companion_synced_at: z.string().optional(),
  android_companion_synced_at: z.string().optional(),
  sync_status: z.object({
    ios: SyncStatusEntrySchema.optional(),
    android: SyncStatusEntrySchema.optional(),
    garmin: SyncStatusEntrySchema.optional(),
  }).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const WorkoutProgramSchema = z.object({
  id: z.string(),
  profile_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  current_day_index: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  members: z.array(z.object({
    id: z.string(),
    program_id: z.string(),
    workout_id: z.string().optional(),
    follow_along_id: z.string().optional(),
    day_order: z.number(),
    created_at: z.string(),
  })).optional(),
});

export const UserTagSchema = z.object({
  id: z.string(),
  profile_id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  created_at: z.string(),
});

// Compile-time verification: if generated types change, these will error.
type _VerifySavedWorkout = z.infer<typeof SavedWorkoutSchema> extends SavedWorkout ? true : never;
type _VerifyProgram = z.infer<typeof WorkoutProgramSchema> extends WorkoutProgram ? true : never;
type _VerifyTag = z.infer<typeof UserTagSchema> extends UserTag ? true : never;
