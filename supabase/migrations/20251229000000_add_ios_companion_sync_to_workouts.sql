-- Add iOS Companion App sync tracking to workouts table (AMA-199)
-- This enables the iOS app to discover workouts that have been "pushed" from the web app

ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS ios_companion_synced_at TIMESTAMPTZ;

-- Add index for efficient lookup of pending iOS companion workouts
CREATE INDEX IF NOT EXISTS idx_workouts_ios_companion_synced
ON workouts (profile_id, ios_companion_synced_at DESC)
WHERE ios_companion_synced_at IS NOT NULL;

COMMENT ON COLUMN workouts.ios_companion_synced_at IS
  'Timestamp when workout was pushed to iOS Companion App. NULL means not pushed.';
