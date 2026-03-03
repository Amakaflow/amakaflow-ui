import { z } from 'zod';
import type {
  GarminGetWorkoutsRequest, GarminImportRequest,
  GarminScheduleRequest, GarminCreateWorkoutRequest,
  GarminImportResponse, GarminScheduleResponse,
  GarminCreateWorkoutResponse, GarminHealthResponse,
} from '../generated/garmin';

// TODO: refine when endpoints finalized — garmin-sync-api is UNOFFICIAL / TEST ONLY
// Workout step and workout body shapes are opaque — use z.record(z.unknown()) stubs

export const GarminWorkoutSchema = z.record(z.unknown());

export const GarminGetWorkoutsRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
});

export const GarminGetWorkoutsResponseSchema = z.object({
  workouts: z.array(GarminWorkoutSchema),
});

export const GarminGetWorkoutResponseSchema = z.object({
  workout: GarminWorkoutSchema,
});

export const GarminImportRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
  workouts: z.record(z.unknown()),
  delete_same_name: z.boolean().optional(),
});

export const GarminImportResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
});

export const GarminScheduleRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
  start_from: z.string(),
  workouts: z.array(z.string()),
});

export const GarminScheduleResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
});

export const GarminCreateWorkoutRequestSchema = z.object({
  name: z.string(),
  steps: z.array(z.unknown()),
  sport: z.string().optional(),
});

export const GarminCreateWorkoutResponseSchema = z.object({
  workout: GarminWorkoutSchema,
});

export const GarminHealthResponseSchema = z.object({
  status: z.string(),
  service: z.string(),
  note: z.string(),
  enabled: z.boolean(),
});

// Compile-time verification
type _VerifyGetWorkoutsReq = z.infer<typeof GarminGetWorkoutsRequestSchema> extends GarminGetWorkoutsRequest ? true : never;
type _VerifyImportReq = z.infer<typeof GarminImportRequestSchema> extends GarminImportRequest ? true : never;
type _VerifyImportRes = z.infer<typeof GarminImportResponseSchema> extends GarminImportResponse ? true : never;
type _VerifyScheduleReq = z.infer<typeof GarminScheduleRequestSchema> extends GarminScheduleRequest ? true : never;
type _VerifyScheduleRes = z.infer<typeof GarminScheduleResponseSchema> extends GarminScheduleResponse ? true : never;
type _VerifyCreateReq = z.infer<typeof GarminCreateWorkoutRequestSchema> extends GarminCreateWorkoutRequest ? true : never;
type _VerifyCreateRes = z.infer<typeof GarminCreateWorkoutResponseSchema> extends GarminCreateWorkoutResponse ? true : never;
type _VerifyHealth = z.infer<typeof GarminHealthResponseSchema> extends GarminHealthResponse ? true : never;
