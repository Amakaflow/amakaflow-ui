-- Workout Completions table for storing health metrics from Apple Watch (AMA-189)
-- Captures heart rate, calories, duration when a user completes a workout

CREATE TABLE IF NOT EXISTS workout_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User reference (Clerk user ID)
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Link to what was done (at least one required)
    workout_event_id UUID REFERENCES workout_events(id) ON DELETE SET NULL,
    follow_along_workout_id TEXT REFERENCES follow_along_workouts(id) ON DELETE SET NULL,

    -- Timing
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER NOT NULL,

    -- Health metrics summary
    avg_heart_rate INTEGER,              -- bpm
    max_heart_rate INTEGER,              -- bpm
    min_heart_rate INTEGER,              -- bpm
    active_calories INTEGER,             -- kcal
    total_calories INTEGER,              -- kcal (active + basal)
    distance_meters INTEGER,             -- for running/walking workouts
    steps INTEGER,

    -- Source info
    source TEXT NOT NULL DEFAULT 'apple_watch',  -- 'apple_watch', 'garmin', 'manual'
    source_workout_id TEXT,              -- HealthKit workout UUID or Garmin activity ID

    -- HR time series (for charts)
    heart_rate_samples JSONB,            -- [{t: "2025-01-15T10:00:00Z", bpm: 120}, ...]

    -- Device metadata
    device_info JSONB,                   -- {model, os_version, app_version}

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- At least one workout link required
    CONSTRAINT chk_completion_link CHECK (
        workout_event_id IS NOT NULL OR follow_along_workout_id IS NOT NULL
    )
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_completions_user_date ON workout_completions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_completions_workout_event ON workout_completions(workout_event_id) WHERE workout_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_completions_follow_along ON workout_completions(follow_along_workout_id) WHERE follow_along_workout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_completions_source ON workout_completions(source);

-- Enable Row Level Security
ALTER TABLE workout_completions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own completions
CREATE POLICY "Users can view own completions"
    ON workout_completions
    FOR SELECT
    USING (auth.uid()::text = user_id);

-- Policy: Users can create completions for themselves
CREATE POLICY "Users can create own completions"
    ON workout_completions
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can update their own completions
CREATE POLICY "Users can update own completions"
    ON workout_completions
    FOR UPDATE
    USING (auth.uid()::text = user_id);

-- Policy: Users can delete their own completions
CREATE POLICY "Users can delete own completions"
    ON workout_completions
    FOR DELETE
    USING (auth.uid()::text = user_id);

-- Policy: Service role has full access (for API endpoint access)
CREATE POLICY "Service role full access"
    ON workout_completions
    FOR ALL
    USING (auth.role() = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE workout_completions IS 'Stores workout completion records with health metrics from Apple Watch/Garmin';
COMMENT ON COLUMN workout_completions.user_id IS 'Clerk user ID';
COMMENT ON COLUMN workout_completions.workout_event_id IS 'Link to scheduled workout event (if applicable)';
COMMENT ON COLUMN workout_completions.follow_along_workout_id IS 'Link to follow-along video workout (if applicable)';
COMMENT ON COLUMN workout_completions.duration_seconds IS 'Actual workout duration in seconds';
COMMENT ON COLUMN workout_completions.avg_heart_rate IS 'Average heart rate in bpm';
COMMENT ON COLUMN workout_completions.active_calories IS 'Active calories burned (kcal)';
COMMENT ON COLUMN workout_completions.source IS 'Data source: apple_watch, garmin, or manual';
COMMENT ON COLUMN workout_completions.source_workout_id IS 'HealthKit workout UUID or Garmin activity ID';
COMMENT ON COLUMN workout_completions.heart_rate_samples IS 'Time series HR data for charts [{t, bpm}, ...]';
COMMENT ON COLUMN workout_completions.device_info IS 'Device metadata {model, os_version, app_version}';
