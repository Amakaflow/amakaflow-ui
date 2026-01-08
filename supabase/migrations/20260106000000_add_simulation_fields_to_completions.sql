-- Add simulation tracking fields to workout_completions (AMA-273)
-- Enables companion apps to mark workout completions as simulated during testing

-- Add is_simulated boolean column (defaults to FALSE for existing records)
ALTER TABLE workout_completions
ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN DEFAULT FALSE;

-- Add simulation_config JSONB column for simulation parameters
ALTER TABLE workout_completions
ADD COLUMN IF NOT EXISTS simulation_config JSONB;

-- Add index for efficient filtering of simulated completions
CREATE INDEX IF NOT EXISTS idx_workout_completions_is_simulated
ON workout_completions(is_simulated);

-- Documentation comments
COMMENT ON COLUMN workout_completions.is_simulated IS
'True if this completion was generated via simulation mode in the companion app';

COMMENT ON COLUMN workout_completions.simulation_config IS
'Optional JSON with simulation parameters: speed (float), behavior_profile (string), hr_profile (string)';
