-- Allow service role to bypass RLS for workouts table
-- This is needed for backend API operations that use service role key

-- Policy for service role to insert workouts
CREATE POLICY "Service role can insert workouts"
  ON workouts
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy for service role to select workouts
CREATE POLICY "Service role can select workouts"
  ON workouts
  FOR SELECT
  TO service_role
  USING (true);

-- Policy for service role to update workouts
CREATE POLICY "Service role can update workouts"
  ON workouts
  FOR UPDATE
  TO service_role
  USING (true);

-- Policy for service role to delete workouts
CREATE POLICY "Service role can delete workouts"
  ON workouts
  FOR DELETE
  TO service_role
  USING (true);

