-- ============================================================================
-- AMA-492: Denormalize user_id for RLS Performance
--
-- The original RLS policies for program_weeks and program_workouts use nested
-- subqueries that join through parent tables to verify user ownership:
--
--   program_workouts -> program_weeks -> training_programs (user_id check)
--
-- This two-level join is expensive for every row access. The original schema
-- noted: "If query performance becomes an issue, consider denormalizing user_id
-- onto child tables."
--
-- This migration:
-- 1. Adds user_id column to program_weeks and program_workouts
-- 2. Backfills user_id from parent tables
-- 3. Replaces join-based RLS policies with direct user_id checks (SELECT/UPDATE/DELETE)
-- 4. Keeps join-based INSERT policies (trigger runs after RLS evaluation)
-- 5. Adds indexes for the new user_id columns
-- ============================================================================

-- ============================================================================
-- Step 1: Add user_id columns (nullable initially for backfill)
-- ============================================================================

ALTER TABLE program_weeks
ADD COLUMN IF NOT EXISTS user_id TEXT;

ALTER TABLE program_workouts
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- ============================================================================
-- Step 2: Backfill user_id from parent tables
-- ============================================================================

-- Backfill program_weeks.user_id from training_programs
UPDATE program_weeks pw
SET user_id = tp.user_id
FROM training_programs tp
WHERE pw.program_id = tp.id
AND pw.user_id IS NULL;

-- Backfill program_workouts.user_id from program_weeks (which now has user_id)
UPDATE program_workouts po
SET user_id = pw.user_id
FROM program_weeks pw
WHERE po.week_id = pw.id
AND po.user_id IS NULL;

-- ============================================================================
-- Step 3: Add NOT NULL constraint and foreign key after backfill
-- ============================================================================

-- Make user_id NOT NULL (all existing rows should now have values)
ALTER TABLE program_weeks
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE program_workouts
ALTER COLUMN user_id SET NOT NULL;

-- Add foreign key references to profiles
ALTER TABLE program_weeks
ADD CONSTRAINT fk_program_weeks_user
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE program_workouts
ADD CONSTRAINT fk_program_workouts_user
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================================
-- Step 4: Add indexes for RLS lookups on user_id
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_program_weeks_user ON program_weeks(user_id);
CREATE INDEX IF NOT EXISTS idx_program_workouts_user ON program_workouts(user_id);

-- Composite index for common query: user's workouts by week
CREATE INDEX IF NOT EXISTS idx_program_workouts_user_week ON program_workouts(user_id, week_id);

-- ============================================================================
-- Step 5: Drop old join-based RLS policies
-- ============================================================================

-- program_weeks policies
DROP POLICY IF EXISTS "Users can view weeks of own programs" ON program_weeks;
DROP POLICY IF EXISTS "Users can create weeks for own programs" ON program_weeks;
DROP POLICY IF EXISTS "Users can update weeks of own programs" ON program_weeks;
DROP POLICY IF EXISTS "Users can delete weeks of own programs" ON program_weeks;

-- program_workouts policies
DROP POLICY IF EXISTS "Users can view workouts of own programs" ON program_workouts;
DROP POLICY IF EXISTS "Users can create workouts for own programs" ON program_workouts;
DROP POLICY IF EXISTS "Users can update workouts of own programs" ON program_workouts;
DROP POLICY IF EXISTS "Users can delete workouts of own programs" ON program_workouts;

-- ============================================================================
-- Step 6: Create new RLS policies
--
-- SELECT/UPDATE/DELETE: Use direct user_id check (fast, no joins)
-- INSERT: Keep join-based check (trigger runs after RLS, so can't rely on it)
-- ============================================================================

-- program_weeks policies
CREATE POLICY "Users can view own program weeks"
    ON program_weeks FOR SELECT
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- INSERT must check parent because trigger populates user_id AFTER RLS evaluation
CREATE POLICY "Users can create own program weeks"
    ON program_weeks FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM training_programs tp
        WHERE tp.id = program_weeks.program_id
        AND tp.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    ));

CREATE POLICY "Users can update own program weeks"
    ON program_weeks FOR UPDATE
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete own program weeks"
    ON program_weeks FOR DELETE
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- program_workouts policies
CREATE POLICY "Users can view own program workouts"
    ON program_workouts FOR SELECT
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- INSERT must check parent because trigger populates user_id AFTER RLS evaluation
CREATE POLICY "Users can create own program workouts"
    ON program_workouts FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM program_weeks pw
        JOIN training_programs tp ON tp.id = pw.program_id
        WHERE pw.id = program_workouts.week_id
        AND tp.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    ));

CREATE POLICY "Users can update own program workouts"
    ON program_workouts FOR UPDATE
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete own program workouts"
    ON program_workouts FOR DELETE
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ============================================================================
-- Step 7: Preserve service role access
-- ============================================================================

CREATE POLICY "Service role full access on program weeks"
    ON program_weeks FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Service role full access on program workouts"
    ON program_workouts FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ============================================================================
-- Step 8: Create triggers to auto-populate user_id on INSERT
-- ============================================================================

-- Trigger for program_weeks: copy user_id from parent training_programs
CREATE OR REPLACE FUNCTION set_program_weeks_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        SELECT user_id INTO NEW.user_id
        FROM training_programs
        WHERE id = NEW.program_id;

        IF NEW.user_id IS NULL THEN
            RAISE EXCEPTION 'Cannot set user_id: training_programs with id % not found', NEW.program_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_program_weeks_user_id ON program_weeks;
CREATE TRIGGER trigger_set_program_weeks_user_id
    BEFORE INSERT ON program_weeks
    FOR EACH ROW EXECUTE FUNCTION set_program_weeks_user_id();

-- Trigger for program_workouts: copy user_id from parent program_weeks
CREATE OR REPLACE FUNCTION set_program_workouts_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        SELECT user_id INTO NEW.user_id
        FROM program_weeks
        WHERE id = NEW.week_id;

        IF NEW.user_id IS NULL THEN
            RAISE EXCEPTION 'Cannot set user_id: program_weeks with id % not found', NEW.week_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_program_workouts_user_id ON program_workouts;
CREATE TRIGGER trigger_set_program_workouts_user_id
    BEFORE INSERT ON program_workouts
    FOR EACH ROW EXECUTE FUNCTION set_program_workouts_user_id();

-- ============================================================================
-- Step 9: Prevent user_id modification (data integrity)
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_user_id_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
        RAISE EXCEPTION 'Cannot modify user_id on %', TG_TABLE_NAME;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_program_weeks_user_id_change ON program_weeks;
CREATE TRIGGER prevent_program_weeks_user_id_change
    BEFORE UPDATE ON program_weeks
    FOR EACH ROW EXECUTE FUNCTION prevent_user_id_modification();

DROP TRIGGER IF EXISTS prevent_program_workouts_user_id_change ON program_workouts;
CREATE TRIGGER prevent_program_workouts_user_id_change
    BEFORE UPDATE ON program_workouts
    FOR EACH ROW EXECUTE FUNCTION prevent_user_id_modification();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN program_weeks.user_id IS 'Denormalized user_id for RLS performance - copied from training_programs';
COMMENT ON COLUMN program_workouts.user_id IS 'Denormalized user_id for RLS performance - copied from program_weeks';
