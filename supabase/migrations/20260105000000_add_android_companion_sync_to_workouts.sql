-- Add Android Companion App sync tracking to workouts table (AMA-246)
-- This enables the Android app to discover workouts that have been "pushed" from the web app

ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS android_companion_synced_at TIMESTAMPTZ;

-- Add index for efficient lookup of pending Android companion workouts
CREATE INDEX IF NOT EXISTS idx_workouts_android_companion_synced
ON workouts (profile_id, android_companion_synced_at DESC)
WHERE android_companion_synced_at IS NOT NULL;

COMMENT ON COLUMN workouts.android_companion_synced_at IS
  'Timestamp when workout was pushed to Android Companion App. NULL means not pushed.';
