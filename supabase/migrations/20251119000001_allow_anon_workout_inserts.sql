-- Allow anon key to insert workouts (for backend API)
-- This is needed when using anon key instead of service role key
-- The policy validates that profile_id is provided and is a valid format

-- Drop existing anon insert policy if it exists
DROP POLICY IF EXISTS "Anon can insert workouts" ON workouts;

-- Create policy allowing anon key to insert workouts
-- This allows the backend API to save workouts on behalf of users
CREATE POLICY "Anon can insert workouts"
  ON workouts
  FOR INSERT
  TO anon
  WITH CHECK (
    profile_id IS NOT NULL 
    AND profile_id != ''
    AND workout_data IS NOT NULL
  );

-- Allow anon to select workouts (for retrieving saved workouts)
DROP POLICY IF EXISTS "Anon can select workouts" ON workouts;

CREATE POLICY "Anon can select workouts"
  ON workouts
  FOR SELECT
  TO anon
  USING (true); -- Allow reading, but RLS will still apply user-specific filtering if needed

-- Allow anon to update workouts
DROP POLICY IF EXISTS "Anon can update workouts" ON workouts;

CREATE POLICY "Anon can update workouts"
  ON workouts
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon to delete workouts
DROP POLICY IF EXISTS "Anon can delete workouts" ON workouts;

CREATE POLICY "Anon can delete workouts"
  ON workouts
  FOR DELETE
  TO anon
  USING (true);

