-- Add workout_name column to workout_completions
-- This stores the display name for ad-hoc workouts (Run Again, templates, etc.)
-- that don't have a linked workout_id/workout_event_id

ALTER TABLE workout_completions
ADD COLUMN IF NOT EXISTS workout_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN workout_completions.workout_name IS 'Display name for the workout (used for ad-hoc/template workouts)';
