import { z } from 'zod';
import type {
  StravaActivity, UpdateActivityRequest, UpdateActivityResponse,
  AthleteResponse, CreateActivityRequest, CreateActivityResponse,
} from '../generated/strava';

export const StravaActivitySchema = z.object({
  id: z.number(),
  name: z.string(),
  start_date: z.string(),
  distance: z.number(),
  elapsed_time: z.number(),
  moving_time: z.number(),
  type: z.string(),
  description: z.string().optional(),
  photos: z.object({ count: z.number() }).optional(),
});

export const UpdateActivityRequestSchema = z.object({
  overwriteTitle: z.boolean().optional(),
  newTitle: z.string().optional(),
  overwriteDescription: z.boolean().optional(),
  description: z.string().optional(),
});

export const UpdateActivityResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  updated_at: z.string(),
});

export const AthleteResponseSchema = z.object({
  id: z.number(),
  username: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  profile_medium: z.string().optional(),
  profile: z.string().optional(),
});

export const CreateActivityRequestSchema = z.object({
  name: z.string(),
  activity_type: z.string().optional(),
  start_date: z.string().optional(),
  elapsed_time: z.number().optional(),
  description: z.string().optional(),
  distance: z.number().optional(),
});

export const CreateActivityResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  start_date: z.string(),
  elapsed_time: z.number(),
  distance: z.number(),
  description: z.string(),
});

// Compile-time verification
type _VerifyActivity = z.infer<typeof StravaActivitySchema> extends StravaActivity ? true : never;
type _VerifyUpdateReq = z.infer<typeof UpdateActivityRequestSchema> extends UpdateActivityRequest ? true : never;
type _VerifyUpdateRes = z.infer<typeof UpdateActivityResponseSchema> extends UpdateActivityResponse ? true : never;
type _VerifyAthlete = z.infer<typeof AthleteResponseSchema> extends AthleteResponse ? true : never;
type _VerifyCreateReq = z.infer<typeof CreateActivityRequestSchema> extends CreateActivityRequest ? true : never;
type _VerifyCreateRes = z.infer<typeof CreateActivityResponseSchema> extends CreateActivityResponse ? true : never;
