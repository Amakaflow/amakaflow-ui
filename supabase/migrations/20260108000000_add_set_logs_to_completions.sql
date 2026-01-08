-- Add set_logs column for weight tracking per exercise/set (AMA-281)
-- Enables companion apps to capture weight used during strength exercises

-- Add set_logs JSONB column to store weight logs per exercise
ALTER TABLE workout_completions
ADD COLUMN IF NOT EXISTS set_logs JSONB;

-- Documentation comment
COMMENT ON COLUMN workout_completions.set_logs IS
'Optional array of exercise logs with weight tracking. Format: [{exercise_name, exercise_index, sets: [{set_number, weight, unit, completed}]}]';
