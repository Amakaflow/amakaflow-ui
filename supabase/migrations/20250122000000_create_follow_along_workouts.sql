-- Create FollowAlongWorkout table
CREATE TABLE IF NOT EXISTS follow_along_workouts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'instagram',
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    video_duration_sec INTEGER,
    thumbnail_url TEXT,
    video_proxy_url TEXT,
    garmin_workout_id TEXT,
    garmin_last_sync_at TIMESTAMPTZ,
    apple_watch_workout_id TEXT,
    apple_watch_last_sync_at TIMESTAMPTZ
);

-- Create FollowAlongStep table
CREATE TABLE IF NOT EXISTS follow_along_steps (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    follow_along_workout_id TEXT NOT NULL REFERENCES follow_along_workouts(id) ON DELETE CASCADE,
    "order" INTEGER NOT NULL,
    label TEXT NOT NULL,
    canonical_exercise_id TEXT,
    start_time_sec INTEGER NOT NULL,
    end_time_sec INTEGER NOT NULL,
    duration_sec INTEGER NOT NULL,
    target_reps INTEGER,
    target_duration_sec INTEGER,
    intensity_hint TEXT CHECK (intensity_hint IN ('easy', 'moderate', 'hard')),
    notes TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_follow_along_workouts_user_id ON follow_along_workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_along_workouts_created_at ON follow_along_workouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follow_along_steps_workout_id_order ON follow_along_steps(follow_along_workout_id, "order");

-- Enable RLS
ALTER TABLE follow_along_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_along_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for follow_along_workouts
CREATE POLICY "Users can view their own follow-along workouts"
    ON follow_along_workouts FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own follow-along workouts"
    ON follow_along_workouts FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own follow-along workouts"
    ON follow_along_workouts FOR UPDATE
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own follow-along workouts"
    ON follow_along_workouts FOR DELETE
    USING (auth.uid()::text = user_id);

-- RLS Policies for follow_along_steps
CREATE POLICY "Users can view steps of their own workouts"
    ON follow_along_steps FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM follow_along_workouts
            WHERE follow_along_workouts.id = follow_along_steps.follow_along_workout_id
            AND follow_along_workouts.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert steps to their own workouts"
    ON follow_along_steps FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM follow_along_workouts
            WHERE follow_along_workouts.id = follow_along_steps.follow_along_workout_id
            AND follow_along_workouts.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can update steps of their own workouts"
    ON follow_along_steps FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM follow_along_workouts
            WHERE follow_along_workouts.id = follow_along_steps.follow_along_workout_id
            AND follow_along_workouts.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete steps of their own workouts"
    ON follow_along_steps FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM follow_along_workouts
            WHERE follow_along_workouts.id = follow_along_steps.follow_along_workout_id
            AND follow_along_workouts.user_id = auth.uid()::text
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_follow_along_workout_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_follow_along_workout_updated_at
    BEFORE UPDATE ON follow_along_workouts
    FOR EACH ROW
    EXECUTE FUNCTION update_follow_along_workout_updated_at();





