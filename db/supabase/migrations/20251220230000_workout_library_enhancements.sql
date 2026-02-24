-- AMA-122: Workout Library - Enhanced Organization, Filtering & Discovery
-- Adds favorites, usage tracking, programs, and tags support

-- ============================================================================
-- 1. Add favorites and usage tracking to workouts table
-- ============================================================================

ALTER TABLE workouts ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS favorite_order INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS times_completed INTEGER DEFAULT 0;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Index for efficient favorite queries
CREATE INDEX IF NOT EXISTS idx_workouts_favorite
  ON workouts(profile_id, is_favorite)
  WHERE is_favorite = TRUE;

-- Index for tags queries (GIN for array contains operations)
CREATE INDEX IF NOT EXISTS idx_workouts_tags
  ON workouts USING GIN(tags);

-- Index for sorting by last used
CREATE INDEX IF NOT EXISTS idx_workouts_last_used
  ON workouts(profile_id, last_used_at DESC NULLS LAST);

-- ============================================================================
-- 2. Add favorites and usage tracking to follow_along_workouts table
-- ============================================================================

ALTER TABLE follow_along_workouts ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;
ALTER TABLE follow_along_workouts ADD COLUMN IF NOT EXISTS favorite_order INTEGER;
ALTER TABLE follow_along_workouts ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE follow_along_workouts ADD COLUMN IF NOT EXISTS times_completed INTEGER DEFAULT 0;
ALTER TABLE follow_along_workouts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Index for efficient favorite queries
CREATE INDEX IF NOT EXISTS idx_follow_along_favorite
  ON follow_along_workouts(user_id, is_favorite)
  WHERE is_favorite = TRUE;

-- Index for tags queries
CREATE INDEX IF NOT EXISTS idx_follow_along_tags
  ON follow_along_workouts USING GIN(tags);

-- Index for sorting by last used
CREATE INDEX IF NOT EXISTS idx_follow_along_last_used
  ON follow_along_workouts(user_id, last_used_at DESC NULLS LAST);

-- ============================================================================
-- 3. Create workout_programs table for grouping workouts
-- ============================================================================

CREATE TABLE IF NOT EXISTS workout_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT, -- Optional color for UI display
  icon TEXT, -- Optional icon identifier
  current_day_index INTEGER DEFAULT 0, -- Track progress through program
  is_active BOOLEAN DEFAULT TRUE, -- Whether user is currently doing this program
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient program queries
CREATE INDEX IF NOT EXISTS idx_programs_profile
  ON workout_programs(profile_id);

-- Index for active programs
CREATE INDEX IF NOT EXISTS idx_programs_active
  ON workout_programs(profile_id, is_active)
  WHERE is_active = TRUE;

-- RLS policies for workout_programs
ALTER TABLE workout_programs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own programs
CREATE POLICY "Users can view own programs"
  ON workout_programs FOR SELECT
  USING (profile_id = auth.uid()::text);

-- Users can insert their own programs
CREATE POLICY "Users can insert own programs"
  ON workout_programs FOR INSERT
  WITH CHECK (profile_id = auth.uid()::text);

-- Users can update their own programs
CREATE POLICY "Users can update own programs"
  ON workout_programs FOR UPDATE
  USING (profile_id = auth.uid()::text);

-- Users can delete their own programs
CREATE POLICY "Users can delete own programs"
  ON workout_programs FOR DELETE
  USING (profile_id = auth.uid()::text);

-- Service role can do everything
CREATE POLICY "Service role full access to programs"
  ON workout_programs FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 4. Add program membership to workouts
-- ============================================================================

ALTER TABLE workouts ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES workout_programs(id) ON DELETE SET NULL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS program_day_order INTEGER;

-- Index for efficient program member queries
CREATE INDEX IF NOT EXISTS idx_workouts_program
  ON workouts(program_id, program_day_order)
  WHERE program_id IS NOT NULL;

-- ============================================================================
-- 5. Create program_members junction table (for follow-along workouts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS program_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
  follow_along_id TEXT REFERENCES follow_along_workouts(id) ON DELETE CASCADE,
  day_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Either workout_id or follow_along_id must be set, not both
  CONSTRAINT chk_member_type CHECK (
    (workout_id IS NOT NULL AND follow_along_id IS NULL) OR
    (workout_id IS NULL AND follow_along_id IS NOT NULL)
  )
);

-- Indexes for program member queries
CREATE INDEX IF NOT EXISTS idx_program_members_program
  ON program_members(program_id, day_order);

CREATE INDEX IF NOT EXISTS idx_program_members_workout
  ON program_members(workout_id)
  WHERE workout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_members_follow_along
  ON program_members(follow_along_id)
  WHERE follow_along_id IS NOT NULL;

-- RLS policies for program_members
ALTER TABLE program_members ENABLE ROW LEVEL SECURITY;

-- Users can view members of their own programs
CREATE POLICY "Users can view own program members"
  ON program_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_members.program_id
      AND workout_programs.profile_id = auth.uid()::text
    )
  );

-- Users can manage members of their own programs
CREATE POLICY "Users can insert own program members"
  ON program_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_members.program_id
      AND workout_programs.profile_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can update own program members"
  ON program_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_members.program_id
      AND workout_programs.profile_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete own program members"
  ON program_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_members.program_id
      AND workout_programs.profile_id = auth.uid()::text
    )
  );

-- Service role can do everything
CREATE POLICY "Service role full access to program members"
  ON program_members FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 6. Create user_tags table for managing available tags
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT, -- Optional color for UI display
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique tag names per user
  CONSTRAINT unique_tag_per_user UNIQUE (profile_id, name)
);

-- Index for tag queries
CREATE INDEX IF NOT EXISTS idx_user_tags_profile
  ON user_tags(profile_id);

-- RLS policies for user_tags
ALTER TABLE user_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tags"
  ON user_tags FOR SELECT
  USING (profile_id = auth.uid()::text);

CREATE POLICY "Users can insert own tags"
  ON user_tags FOR INSERT
  WITH CHECK (profile_id = auth.uid()::text);

CREATE POLICY "Users can update own tags"
  ON user_tags FOR UPDATE
  USING (profile_id = auth.uid()::text);

CREATE POLICY "Users can delete own tags"
  ON user_tags FOR DELETE
  USING (profile_id = auth.uid()::text);

CREATE POLICY "Service role full access to user tags"
  ON user_tags FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 7. Helper function to update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_workout_programs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workout_programs_updated_at
  BEFORE UPDATE ON workout_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_workout_programs_updated_at();