-- Allow workout completions without a linked workout/event when workout_structure is provided
--
-- This supports "Run Again" scenarios where:
-- 1. User completes a workout that was created on-device
-- 2. The original workout_id doesn't exist in the workouts table
-- 3. But we still want to save the completion with the workout_structure
--
-- The completion is still useful because it has:
-- - workout_structure: The full workout definition
-- - workout_name: The display name
-- - All health metrics, set_logs, execution_log, etc.

-- Drop the existing constraint
ALTER TABLE workout_completions
DROP CONSTRAINT IF EXISTS chk_completion_link;

-- Add updated constraint that also allows workout_structure as a valid link
ALTER TABLE workout_completions
ADD CONSTRAINT chk_completion_link CHECK (
    workout_event_id IS NOT NULL
    OR follow_along_workout_id IS NOT NULL
    OR workout_id IS NOT NULL
    OR workout_structure IS NOT NULL  -- Allow ad-hoc workouts with embedded structure
);

-- Add comment for documentation
COMMENT ON CONSTRAINT chk_completion_link ON workout_completions IS
'Ensures completion has at least one link to source: workout_event_id, follow_along_workout_id, workout_id, or embedded workout_structure';
