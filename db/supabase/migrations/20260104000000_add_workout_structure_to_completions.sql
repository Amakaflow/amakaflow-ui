-- AMA-240: Add workout_structure column to workout_completions table
-- Stores the original workout structure (intervals/blocks) at time of completion
-- This enables the "Run Again" feature without re-fetching from source workout

ALTER TABLE workout_completions
ADD COLUMN workout_structure JSONB;

-- Add comment for documentation
COMMENT ON COLUMN workout_completions.workout_structure IS 'Original workout structure (intervals/blocks) stored at completion time for "Run Again" feature (AMA-240)';
