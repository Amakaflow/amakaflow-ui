import { z } from 'zod';
import type { WorkoutEvent, ConnectedCalendar } from '../generated/calendar';

export const WorkoutEventSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.string(),
  type: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  status: z.enum(['planned', 'completed']),
  is_anchor: z.boolean(),
  primary_muscle: z.string().optional(),
  intensity: z.number().optional(),
  connected_calendar_id: z.string().optional(),
  connected_calendar_type: z.string().optional(),
  external_event_url: z.string().optional(),
  recurrence_rule: z.string().optional(),
  json_payload: z.record(z.unknown()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const ConnectedCalendarSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  type: z.enum(['runna', 'apple', 'google', 'outlook', 'ics_custom']),
  integration_type: z.enum(['ics_url', 'oauth', 'os_integration']),
  is_workout_calendar: z.boolean(),
  ics_url: z.string().optional(),
  last_sync: z.string().optional(),
  sync_status: z.enum(['active', 'error', 'paused']),
  sync_error_message: z.string().optional(),
  color: z.string().optional(),
  workouts_this_week: z.number(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// Compile-time verification
type _VerifyEvent = z.infer<typeof WorkoutEventSchema> extends WorkoutEvent ? true : never;
type _VerifyCalendar = z.infer<typeof ConnectedCalendarSchema> extends ConnectedCalendar ? true : never;
