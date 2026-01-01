-- Add workout_id column to workout_completions (AMA-217)
--
-- The workout_completions table was missing a FK to the workouts table.
-- iOS Companion receives workout IDs from the workouts table (via /ios-companion/pending)
-- but could only link to workout_events or follow_along_workouts.
--
-- This migration adds the missing workout_id column and updates the constraint.

-- Add the new column
ALTER TABLE workout_completions
ADD COLUMN workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_completions_workout ON workout_completions(workout_id)
WHERE workout_id IS NOT NULL;

-- Drop the old constraint that only checked workout_event_id and follow_along_workout_id
ALTER TABLE workout_completions
DROP CONSTRAINT IF EXISTS chk_completion_link;

-- Add new constraint that includes workout_id
ALTER TABLE workout_completions
ADD CONSTRAINT chk_completion_link CHECK (
    workout_event_id IS NOT NULL
    OR follow_along_workout_id IS NOT NULL
    OR workout_id IS NOT NULL
);

-- Add comment for documentation
COMMENT ON COLUMN workout_completions.workout_id IS 'Link to workouts table (for iOS Companion workouts pushed from web app)';
