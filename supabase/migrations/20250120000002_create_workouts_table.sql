-- Create workouts table for storing user workouts
-- This table stores workout data that can be saved before syncing to devices
-- and retrieved later for syncing

CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL,
  workout_data JSONB NOT NULL, -- Full workout structure (WorkoutStructure)
  sources TEXT[] DEFAULT '{}', -- Array of source strings
  device TEXT NOT NULL, -- Device ID (garmin, apple, zwift, etc.)
  exports JSONB, -- Export formats if available
  validation JSONB, -- Validation response if available
  title TEXT, -- Optional workout title/name
  description TEXT, -- Optional workout description
  is_exported BOOLEAN DEFAULT FALSE, -- Whether workout has been exported/synced to device
  exported_at TIMESTAMPTZ, -- When the workout was exported
  exported_to_device TEXT, -- Which device it was exported to
  synced_to_strava BOOLEAN DEFAULT FALSE, -- Whether synced to Strava
  strava_activity_id TEXT, -- Strava activity ID if synced
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT workouts_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workouts_profile_id ON workouts(profile_id);
CREATE INDEX IF NOT EXISTS idx_workouts_created_at ON workouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_is_exported ON workouts(is_exported);
CREATE INDEX IF NOT EXISTS idx_workouts_device ON workouts(device);
CREATE INDEX IF NOT EXISTS idx_workouts_profile_device ON workouts(profile_id, device);

-- Enable Row Level Security
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own workouts
CREATE POLICY "Users can view their own workouts"
  ON workouts
  FOR SELECT
  USING (auth.uid()::text = profile_id OR profile_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policy: Users can insert their own workouts
CREATE POLICY "Users can insert their own workouts"
  ON workouts
  FOR INSERT
  WITH CHECK (auth.uid()::text = profile_id OR profile_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policy: Users can update their own workouts
CREATE POLICY "Users can update their own workouts"
  ON workouts
  FOR UPDATE
  USING (auth.uid()::text = profile_id OR profile_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policy: Users can delete their own workouts
CREATE POLICY "Users can delete their own workouts"
  ON workouts
  FOR DELETE
  USING (auth.uid()::text = profile_id OR profile_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_workouts_updated_at
  BEFORE UPDATE ON workouts
  FOR EACH ROW
  EXECUTE FUNCTION update_workouts_updated_at();

-- Add comment to table
COMMENT ON TABLE workouts IS 'Stores user workouts that can be saved before syncing to devices';
COMMENT ON COLUMN workouts.workout_data IS 'Full workout structure in JSONB format';
COMMENT ON COLUMN workouts.is_exported IS 'Whether the workout has been exported/synced to a device';
COMMENT ON COLUMN workouts.exported_at IS 'Timestamp when the workout was exported';
COMMENT ON COLUMN workouts.exported_to_device IS 'Device ID that the workout was exported to';


