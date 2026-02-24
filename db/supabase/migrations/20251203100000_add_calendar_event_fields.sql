-- Add missing fields to workout_events table for full calendar functionality
-- These fields support connected calendars, anchor workouts, and smart planner features

-- Add is_anchor field (marks key workouts like long runs, trainer sessions)
ALTER TABLE public.workout_events 
ADD COLUMN IF NOT EXISTS is_anchor BOOLEAN DEFAULT FALSE;

-- Add primary_muscle field (for strength workout categorization)
ALTER TABLE public.workout_events 
ADD COLUMN IF NOT EXISTS primary_muscle TEXT 
CHECK (primary_muscle IN ('upper', 'lower', 'full_body', 'core', 'none'));

-- Add intensity field (0=recovery, 1=easy, 2=moderate, 3=hard)
ALTER TABLE public.workout_events 
ADD COLUMN IF NOT EXISTS intensity INTEGER DEFAULT 1
CHECK (intensity >= 0 AND intensity <= 3);

-- Add connected calendar fields
ALTER TABLE public.workout_events 
ADD COLUMN IF NOT EXISTS connected_calendar_id UUID;

ALTER TABLE public.workout_events 
ADD COLUMN IF NOT EXISTS connected_calendar_type TEXT
CHECK (connected_calendar_type IN ('runna', 'apple', 'google', 'outlook', 'ics_custom'));

-- Add external event URL (link to open in original calendar app)
ALTER TABLE public.workout_events 
ADD COLUMN IF NOT EXISTS external_event_url TEXT;

-- Add recurrence rule (RRULE format for recurring events)
ALTER TABLE public.workout_events 
ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;

-- Update source column to allow new values
-- First drop the existing check constraint if it exists
ALTER TABLE public.workout_events 
DROP CONSTRAINT IF EXISTS workout_events_source_check;

-- Add updated check constraint with all valid sources
ALTER TABLE public.workout_events 
ADD CONSTRAINT workout_events_source_check 
CHECK (source IN (
  'manual',
  'gym_manual_sync', 
  'connected_calendar',
  'smart_planner',
  'template',
  'gym_class',
  'amaka',
  'instagram',
  'tiktok',
  'garmin',
  'runna'
));

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_workout_events_is_anchor 
ON public.workout_events(is_anchor) WHERE is_anchor = TRUE;

CREATE INDEX IF NOT EXISTS idx_workout_events_connected_calendar 
ON public.workout_events(connected_calendar_id) WHERE connected_calendar_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_events_date_user 
ON public.workout_events(user_id, date);

-- Add comments
COMMENT ON COLUMN public.workout_events.is_anchor IS 'True for key workouts that should not be moved by Smart Planner';
COMMENT ON COLUMN public.workout_events.primary_muscle IS 'Primary muscle group for strength workouts';
COMMENT ON COLUMN public.workout_events.intensity IS '0=recovery, 1=easy, 2=moderate, 3=hard';
COMMENT ON COLUMN public.workout_events.connected_calendar_id IS 'ID of connected calendar this event came from';
COMMENT ON COLUMN public.workout_events.connected_calendar_type IS 'Type of connected calendar (runna, apple, google, etc.)';
COMMENT ON COLUMN public.workout_events.external_event_url IS 'URL to open event in original calendar app';
COMMENT ON COLUMN public.workout_events.recurrence_rule IS 'RRULE format string for recurring events';
