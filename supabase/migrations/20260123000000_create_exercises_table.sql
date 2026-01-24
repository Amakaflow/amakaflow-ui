-- Create canonical exercises table for progression tracking (AMA-299)
-- Enables: 1RM calculation, body part analytics, "use last weight", exercise matching

CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY
        CONSTRAINT chk_exercises_id_format CHECK (id ~ '^[a-z0-9-]+$'),  -- lowercase slug format
    name TEXT NOT NULL,                     -- "Incline Smith Machine Press"
    aliases TEXT[] DEFAULT '{}',            -- {"Smith Machine Incline Press", "Incline Smith Press"}

    -- Muscle targeting
    primary_muscles TEXT[] NOT NULL,        -- {"chest"}
    secondary_muscles TEXT[] DEFAULT '{}',  -- {"anterior_deltoid", "triceps"}

    -- Equipment
    equipment TEXT[] DEFAULT '{}',          -- {"smith_machine", "bench"}
    default_weight_source TEXT,             -- "machine"

    -- 1RM support
    supports_1rm BOOLEAN DEFAULT false,
    one_rm_formula TEXT
        CONSTRAINT chk_exercises_one_rm_formula CHECK (one_rm_formula IN ('brzycki', 'epley') OR one_rm_formula IS NULL),

    -- Metadata
    category TEXT
        CONSTRAINT chk_exercises_category CHECK (category IN ('compound', 'isolation', 'cardio') OR category IS NULL),
    movement_pattern TEXT
        CONSTRAINT chk_exercises_movement_pattern CHECK (movement_pattern IN ('push', 'pull', 'squat', 'hinge', 'carry', 'rotation') OR movement_pattern IS NULL),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GIN indexes for efficient array queries
CREATE INDEX IF NOT EXISTS idx_exercises_primary_muscles ON exercises USING GIN (primary_muscles);
CREATE INDEX IF NOT EXISTS idx_exercises_secondary_muscles ON exercises USING GIN (secondary_muscles);
CREATE INDEX IF NOT EXISTS idx_exercises_aliases ON exercises USING GIN (aliases);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises USING GIN (equipment);

-- B-tree index for exact name lookups
CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises (name);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_exercises_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_exercises_updated_at ON exercises;
CREATE TRIGGER trigger_exercises_updated_at
    BEFORE UPDATE ON exercises
    FOR EACH ROW EXECUTE FUNCTION update_exercises_updated_at();

-- Comments
COMMENT ON TABLE exercises IS 'Canonical exercise database for progression tracking, 1RM calculation, and muscle group analytics';
COMMENT ON COLUMN exercises.id IS 'URL-safe slug identifier, e.g., "barbell-bench-press"';
COMMENT ON COLUMN exercises.aliases IS 'Alternative names for fuzzy matching';
COMMENT ON COLUMN exercises.primary_muscles IS 'Primary muscle groups targeted';
COMMENT ON COLUMN exercises.secondary_muscles IS 'Secondary/synergist muscles';
COMMENT ON COLUMN exercises.default_weight_source IS 'Default weight type: barbell, dumbbell, machine, bodyweight, etc.';
COMMENT ON COLUMN exercises.supports_1rm IS 'Whether 1RM calculation makes sense for this exercise';
COMMENT ON COLUMN exercises.one_rm_formula IS 'Preferred 1RM formula: brzycki or epley';
COMMENT ON COLUMN exercises.category IS 'Exercise category: compound, isolation, or cardio';
COMMENT ON COLUMN exercises.movement_pattern IS 'Movement pattern: push, pull, squat, hinge, carry, or rotation';

-- Enable RLS
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Public read access (exercises are shared reference data)
-- Using DO block for idempotency (CREATE POLICY doesn't support IF NOT EXISTS)
DO $$ BEGIN
    CREATE POLICY "Exercises are publicly readable"
        ON exercises FOR SELECT
        USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Only service role can modify exercises (matches pattern from workout_sync_queue)
DO $$ BEGIN
    CREATE POLICY "Service role can manage exercises"
        ON exercises FOR ALL
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
