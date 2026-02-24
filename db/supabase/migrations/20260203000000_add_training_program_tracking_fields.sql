-- ============================================================================
-- AMA-528: Add Missing Fields to Training Programs Tables
--
-- Adds fields required for the UI training program management:
-- 1. started_at, completed_at, notes on training_programs
-- 2. user_id on program_weeks and program_workouts for direct filtering
-- 3. is_completed, completed_at on program_workouts
-- 4. created_at on program_weeks and program_workouts
-- ============================================================================

-- ============================================================================
-- Add columns to training_programs
-- ============================================================================
ALTER TABLE training_programs
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN training_programs.started_at IS 'When the program was first activated';
COMMENT ON COLUMN training_programs.completed_at IS 'When the program was marked completed';
COMMENT ON COLUMN training_programs.notes IS 'User notes about the program';

-- ============================================================================
-- Add columns to program_weeks
-- ============================================================================
ALTER TABLE program_weeks
    ADD COLUMN IF NOT EXISTS user_id TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN program_weeks.user_id IS 'Denormalized user_id for direct filtering';
COMMENT ON COLUMN program_weeks.created_at IS 'When the week was created';

-- Create index for user_id filtering
CREATE INDEX IF NOT EXISTS idx_program_weeks_user ON program_weeks(user_id);

-- ============================================================================
-- Add columns to program_workouts
-- ============================================================================
ALTER TABLE program_workouts
    ADD COLUMN IF NOT EXISTS user_id TEXT,
    ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN program_workouts.user_id IS 'Denormalized user_id for direct filtering';
COMMENT ON COLUMN program_workouts.is_completed IS 'Whether the workout has been completed';
COMMENT ON COLUMN program_workouts.completed_at IS 'When the workout was marked completed';
COMMENT ON COLUMN program_workouts.created_at IS 'When the workout was created';

-- Create index for user_id filtering
CREATE INDEX IF NOT EXISTS idx_program_workouts_user ON program_workouts(user_id);

-- ============================================================================
-- Backfill user_id from parent training_programs
-- ============================================================================
UPDATE program_weeks pw
SET user_id = tp.user_id
FROM training_programs tp
WHERE pw.program_id = tp.id
AND pw.user_id IS NULL;

UPDATE program_workouts pwo
SET user_id = tp.user_id
FROM program_weeks pw
JOIN training_programs tp ON tp.id = pw.program_id
WHERE pwo.week_id = pw.id
AND pwo.user_id IS NULL;

-- ============================================================================
-- Create trigger to auto-populate user_id on program_weeks insert
-- ============================================================================
CREATE OR REPLACE FUNCTION set_program_weeks_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        SELECT user_id INTO NEW.user_id
        FROM training_programs
        WHERE id = NEW.program_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_program_weeks_user_id ON program_weeks;
CREATE TRIGGER trigger_set_program_weeks_user_id
    BEFORE INSERT ON program_weeks
    FOR EACH ROW EXECUTE FUNCTION set_program_weeks_user_id();

-- ============================================================================
-- Create trigger to auto-populate user_id on program_workouts insert
-- ============================================================================
CREATE OR REPLACE FUNCTION set_program_workouts_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        SELECT tp.user_id INTO NEW.user_id
        FROM program_weeks pw
        JOIN training_programs tp ON tp.id = pw.program_id
        WHERE pw.id = NEW.week_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_program_workouts_user_id ON program_workouts;
CREATE TRIGGER trigger_set_program_workouts_user_id
    BEFORE INSERT ON program_workouts
    FOR EACH ROW EXECUTE FUNCTION set_program_workouts_user_id();

-- ============================================================================
-- Update RLS policies to also allow direct user_id checks (faster)
-- ============================================================================

-- Add direct user_id check policies for program_weeks
DO $$ BEGIN
    CREATE POLICY "Users can view weeks by direct user_id"
        ON program_weeks FOR SELECT
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add direct user_id check policies for program_workouts
DO $$ BEGIN
    CREATE POLICY "Users can view workouts by direct user_id"
        ON program_workouts FOR SELECT
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update workouts by direct user_id"
        ON program_workouts FOR UPDATE
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
