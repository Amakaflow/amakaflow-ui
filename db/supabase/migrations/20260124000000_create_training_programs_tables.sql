-- ============================================================================
-- Training Programs Tables
-- AMA-460: AI Training Program Generation - Database Schema
--
-- Creates 5 tables for AI-generated periodized training programs:
-- 1. training_programs - Main program definition
-- 2. program_weeks - Weekly structure with periodization
-- 3. program_workouts - Individual workout sessions
-- 4. user_exercise_history - Progression tracking per exercise
-- 5. program_templates - Reusable templates for hybrid generation
-- ============================================================================

-- ============================================================================
-- Table: training_programs
-- Main table storing user training programs with goals and periodization
-- ============================================================================
CREATE TABLE IF NOT EXISTS training_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    goal TEXT NOT NULL CHECK (goal IN (
        'strength', 'hypertrophy', 'endurance', 'power',
        'fat_loss', 'general_fitness', 'sport_specific', 'rehabilitation'
    )),
    periodization_model TEXT NOT NULL DEFAULT 'linear' CHECK (periodization_model IN (
        'linear', 'undulating', 'block', 'conjugate', 'reverse_linear'
    )),
    duration_weeks INTEGER NOT NULL CHECK (duration_weeks BETWEEN 4 AND 52),
    sessions_per_week INTEGER NOT NULL CHECK (sessions_per_week BETWEEN 1 AND 7),
    experience_level TEXT NOT NULL CHECK (experience_level IN (
        'beginner', 'intermediate', 'advanced', 'elite'
    )),
    equipment_available TEXT[] NOT NULL DEFAULT '{}',
    time_per_session_minutes INTEGER DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'active', 'paused', 'completed', 'archived'
    )),
    current_week INTEGER DEFAULT 0,
    generation_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Table: program_weeks
-- Weekly structure with periodization parameters
-- ============================================================================
CREATE TABLE IF NOT EXISTS program_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL CHECK (week_number >= 1),
    focus TEXT,
    intensity_percentage INTEGER CHECK (intensity_percentage BETWEEN 50 AND 110),
    volume_modifier DECIMAL(4,2) DEFAULT 1.0 CHECK (volume_modifier BETWEEN 0.1 AND 3.0),
    is_deload BOOLEAN DEFAULT FALSE,
    notes TEXT,
    UNIQUE(program_id, week_number)
);

-- ============================================================================
-- Table: program_workouts
-- Individual workout sessions within a week
-- ============================================================================
CREATE TABLE IF NOT EXISTS program_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id UUID NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    name TEXT NOT NULL,
    workout_type TEXT NOT NULL,
    target_duration_minutes INTEGER,
    exercises JSONB NOT NULL DEFAULT '[]',
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    UNIQUE(week_id, day_of_week, sort_order)
);

-- ============================================================================
-- Table: user_exercise_history
-- Per-user exercise progression tracking for 1RM, personal bests, volume
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_exercise_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
    exercise_name TEXT NOT NULL,
    estimated_1rm DECIMAL(10,2),
    last_weight DECIMAL(10,2),
    last_reps INTEGER,
    personal_best_weight DECIMAL(10,2),
    personal_best_reps INTEGER,
    total_volume_lifetime DECIMAL(15,2) DEFAULT 0,
    session_count INTEGER DEFAULT 0,
    last_performed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique indexes to handle NULL exercise_id correctly
-- PostgreSQL treats NULLs as distinct, so we need separate indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_history_user_exercise_unique
    ON user_exercise_history(user_id, exercise_id)
    WHERE exercise_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_history_user_name_unique
    ON user_exercise_history(user_id, exercise_name)
    WHERE exercise_id IS NULL;

-- ============================================================================
-- Table: program_templates
-- Reusable templates for hybrid AI + template generation
-- ============================================================================
CREATE TABLE IF NOT EXISTS program_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    goal TEXT NOT NULL CHECK (goal IN (
        'strength', 'hypertrophy', 'endurance', 'power',
        'fat_loss', 'general_fitness', 'sport_specific', 'rehabilitation'
    )),
    periodization_model TEXT NOT NULL CHECK (periodization_model IN (
        'linear', 'undulating', 'block', 'conjugate', 'reverse_linear'
    )),
    experience_level TEXT NOT NULL CHECK (experience_level IN (
        'beginner', 'intermediate', 'advanced', 'elite'
    )),
    duration_weeks INTEGER NOT NULL CHECK (duration_weeks BETWEEN 4 AND 52),
    structure JSONB NOT NULL,
    is_system_template BOOLEAN NOT NULL DEFAULT TRUE,
    created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- training_programs indexes
CREATE INDEX IF NOT EXISTS idx_programs_user ON training_programs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_programs_goal ON training_programs(goal);
-- Partial index for common query: find user's active program
CREATE INDEX IF NOT EXISTS idx_programs_user_active ON training_programs(user_id) WHERE status = 'active';

-- program_weeks indexes
CREATE INDEX IF NOT EXISTS idx_weeks_program ON program_weeks(program_id);

-- program_workouts indexes
CREATE INDEX IF NOT EXISTS idx_workouts_week ON program_workouts(week_id);

-- user_exercise_history indexes
CREATE INDEX IF NOT EXISTS idx_exercise_history_user ON user_exercise_history(user_id, last_performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_history_exercise ON user_exercise_history(exercise_id);

-- program_templates indexes
CREATE INDEX IF NOT EXISTS idx_templates_goal ON program_templates(goal, experience_level);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_exercise_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies: training_programs (user-scoped)
-- ============================================================================

DO $$ BEGIN
    CREATE POLICY "Users can view own training programs"
        ON training_programs FOR SELECT
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can create own training programs"
        ON training_programs FOR INSERT
        WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own training programs"
        ON training_programs FOR UPDATE
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete own training programs"
        ON training_programs FOR DELETE
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role full access on training programs"
        ON training_programs FOR ALL
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- RLS Policies: program_weeks (inherits access from training_programs)
-- ============================================================================

DO $$ BEGIN
    CREATE POLICY "Users can view weeks of own programs"
        ON program_weeks FOR SELECT
        USING (EXISTS (
            SELECT 1 FROM training_programs tp
            WHERE tp.id = program_weeks.program_id
            AND tp.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can create weeks for own programs"
        ON program_weeks FOR INSERT
        WITH CHECK (EXISTS (
            SELECT 1 FROM training_programs tp
            WHERE tp.id = program_weeks.program_id
            AND tp.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update weeks of own programs"
        ON program_weeks FOR UPDATE
        USING (EXISTS (
            SELECT 1 FROM training_programs tp
            WHERE tp.id = program_weeks.program_id
            AND tp.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete weeks of own programs"
        ON program_weeks FOR DELETE
        USING (EXISTS (
            SELECT 1 FROM training_programs tp
            WHERE tp.id = program_weeks.program_id
            AND tp.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role full access on program weeks"
        ON program_weeks FOR ALL
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- RLS Policies: program_workouts (inherits access from program_weeks -> training_programs)
-- NOTE: These policies use nested subqueries through program_weeks to training_programs.
-- This ensures proper data isolation but may have performance implications at scale.
-- If query performance becomes an issue, consider denormalizing user_id onto child tables.
-- ============================================================================

DO $$ BEGIN
    CREATE POLICY "Users can view workouts of own programs"
        ON program_workouts FOR SELECT
        USING (EXISTS (
            SELECT 1 FROM program_weeks pw
            JOIN training_programs tp ON tp.id = pw.program_id
            WHERE pw.id = program_workouts.week_id
            AND tp.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can create workouts for own programs"
        ON program_workouts FOR INSERT
        WITH CHECK (EXISTS (
            SELECT 1 FROM program_weeks pw
            JOIN training_programs tp ON tp.id = pw.program_id
            WHERE pw.id = program_workouts.week_id
            AND tp.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update workouts of own programs"
        ON program_workouts FOR UPDATE
        USING (EXISTS (
            SELECT 1 FROM program_weeks pw
            JOIN training_programs tp ON tp.id = pw.program_id
            WHERE pw.id = program_workouts.week_id
            AND tp.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete workouts of own programs"
        ON program_workouts FOR DELETE
        USING (EXISTS (
            SELECT 1 FROM program_weeks pw
            JOIN training_programs tp ON tp.id = pw.program_id
            WHERE pw.id = program_workouts.week_id
            AND tp.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role full access on program workouts"
        ON program_workouts FOR ALL
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- RLS Policies: user_exercise_history (user-scoped)
-- ============================================================================

DO $$ BEGIN
    CREATE POLICY "Users can view own exercise history"
        ON user_exercise_history FOR SELECT
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can create own exercise history"
        ON user_exercise_history FOR INSERT
        WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own exercise history"
        ON user_exercise_history FOR UPDATE
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete own exercise history"
        ON user_exercise_history FOR DELETE
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role full access on exercise history"
        ON user_exercise_history FOR ALL
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- RLS Policies: program_templates (public read, service role write)
-- ============================================================================

-- System templates are public; user-created templates are private to the creator
DO $$ BEGIN
    CREATE POLICY "Users can view system templates or own templates"
        ON program_templates FOR SELECT
        USING (
            is_system_template = TRUE
            OR created_by = current_setting('request.jwt.claims', true)::json->>'sub'
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role can manage program templates"
        ON program_templates FOR ALL
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Updated at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_training_programs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_training_programs_updated_at ON training_programs;
CREATE TRIGGER trigger_training_programs_updated_at
    BEFORE UPDATE ON training_programs
    FOR EACH ROW EXECUTE FUNCTION update_training_programs_updated_at();

CREATE OR REPLACE FUNCTION update_user_exercise_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_exercise_history_updated_at ON user_exercise_history;
CREATE TRIGGER trigger_user_exercise_history_updated_at
    BEFORE UPDATE ON user_exercise_history
    FOR EACH ROW EXECUTE FUNCTION update_user_exercise_history_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

-- training_programs
COMMENT ON TABLE training_programs IS 'AI-generated periodized training programs with goals and progression settings';
COMMENT ON COLUMN training_programs.user_id IS 'Clerk user ID';
COMMENT ON COLUMN training_programs.goal IS 'Primary training goal: strength, hypertrophy, endurance, power, fat_loss, general_fitness, sport_specific, rehabilitation';
COMMENT ON COLUMN training_programs.periodization_model IS 'Periodization approach: linear, undulating, block, conjugate, reverse_linear';
COMMENT ON COLUMN training_programs.duration_weeks IS 'Total program duration (4-52 weeks)';
COMMENT ON COLUMN training_programs.sessions_per_week IS 'Training frequency (1-7 sessions per week)';
COMMENT ON COLUMN training_programs.experience_level IS 'User experience: beginner, intermediate, advanced, elite';
COMMENT ON COLUMN training_programs.equipment_available IS 'Array of available equipment for exercise selection';
COMMENT ON COLUMN training_programs.time_per_session_minutes IS 'Target duration per workout session';
COMMENT ON COLUMN training_programs.status IS 'Program state: draft, active, paused, completed, archived';
COMMENT ON COLUMN training_programs.current_week IS 'Current week in program progression';
COMMENT ON COLUMN training_programs.generation_metadata IS 'AI generation parameters and version info';

-- program_weeks
COMMENT ON TABLE program_weeks IS 'Weekly structure within a training program with periodization parameters';
COMMENT ON COLUMN program_weeks.week_number IS 'Week number within the program (1-indexed)';
COMMENT ON COLUMN program_weeks.focus IS 'Training focus for this week (e.g., "Hypertrophy", "Strength", "Recovery")';
COMMENT ON COLUMN program_weeks.intensity_percentage IS 'Target intensity as percentage of 1RM (50-110%)';
COMMENT ON COLUMN program_weeks.volume_modifier IS 'Multiplier for volume adjustment (e.g., 0.7 for deload)';
COMMENT ON COLUMN program_weeks.is_deload IS 'Whether this is a deload/recovery week';

-- program_workouts
COMMENT ON TABLE program_workouts IS 'Individual workout sessions within a program week';
COMMENT ON COLUMN program_workouts.day_of_week IS 'Day of week (0=Sunday through 6=Saturday)';
COMMENT ON COLUMN program_workouts.workout_type IS 'Type of workout (e.g., "Upper Body", "Lower Body", "Full Body", "Push", "Pull")';
COMMENT ON COLUMN program_workouts.target_duration_minutes IS 'Expected workout duration in minutes';
COMMENT ON COLUMN program_workouts.exercises IS 'JSONB array of exercises with sets, reps, rest periods';
COMMENT ON COLUMN program_workouts.sort_order IS 'Ordering for multiple workouts on same day';

-- user_exercise_history
COMMENT ON TABLE user_exercise_history IS 'Per-user exercise progression tracking for personalized programming';
COMMENT ON COLUMN user_exercise_history.exercise_id IS 'Reference to canonical exercise (TEXT slug format)';
COMMENT ON COLUMN user_exercise_history.exercise_name IS 'Denormalized exercise name for display';
COMMENT ON COLUMN user_exercise_history.estimated_1rm IS 'Calculated one-rep max in user weight units';
COMMENT ON COLUMN user_exercise_history.last_weight IS 'Most recent weight used';
COMMENT ON COLUMN user_exercise_history.last_reps IS 'Most recent rep count';
COMMENT ON COLUMN user_exercise_history.personal_best_weight IS 'Heaviest weight ever used';
COMMENT ON COLUMN user_exercise_history.personal_best_reps IS 'Highest reps at personal best weight';
COMMENT ON COLUMN user_exercise_history.total_volume_lifetime IS 'Cumulative volume (weight × reps) for analytics';
COMMENT ON COLUMN user_exercise_history.session_count IS 'Number of sessions this exercise was performed';
COMMENT ON COLUMN user_exercise_history.last_performed_at IS 'Timestamp of most recent performance';

-- program_templates
COMMENT ON TABLE program_templates IS 'Reusable program templates for hybrid AI + template generation';
COMMENT ON COLUMN program_templates.goal IS 'Target goal this template is designed for';
COMMENT ON COLUMN program_templates.periodization_model IS 'Periodization approach used in template';
COMMENT ON COLUMN program_templates.experience_level IS 'Target experience level';
COMMENT ON COLUMN program_templates.duration_weeks IS 'Template duration in weeks';
COMMENT ON COLUMN program_templates.structure IS 'JSONB structure defining weeks and workout patterns';
COMMENT ON COLUMN program_templates.is_system_template IS 'Whether this is a system-provided template vs user-created';
COMMENT ON COLUMN program_templates.created_by IS 'User who created the template (null for system templates)';
COMMENT ON COLUMN program_templates.usage_count IS 'Number of times this template has been used';
