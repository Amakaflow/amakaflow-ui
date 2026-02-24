-- Add execution_log column for capturing actual execution data vs planned workout (AMA-290)
-- This column stores structured data about how each interval was executed, including:
-- - Status (completed, skipped, modified)
-- - Actual vs planned duration
-- - Set weights and reps for strength exercises

-- Add execution_log JSONB column
ALTER TABLE workout_completions
ADD COLUMN IF NOT EXISTS execution_log JSONB;

-- Create GIN index for efficient querying of execution stats
CREATE INDEX IF NOT EXISTS idx_completions_execution_log
ON workout_completions USING GIN (execution_log jsonb_path_ops);

-- Documentation comment
COMMENT ON COLUMN workout_completions.execution_log IS
'Structured execution data capturing actual workout performance. Format: {intervals: [{interval_index, kind, name, status, planned_duration_sec, actual_duration_sec, started_at, ended_at, sets: [...]}], summary: {total_intervals, completed, skipped, modified, completion_percentage}}';
