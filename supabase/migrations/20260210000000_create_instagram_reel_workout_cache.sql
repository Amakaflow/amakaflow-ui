-- Instagram Reel workout cache table (AMA-564)
-- Caches structured workouts extracted from Instagram Reels via Apify
-- to avoid redundant API calls and AI processing.

CREATE TABLE IF NOT EXISTS instagram_reel_workout_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reel identification
    shortcode TEXT NOT NULL UNIQUE,  -- Instagram shortcode (e.g., DRHiuniDM1K)
    source_url TEXT NOT NULL,        -- Original URL submitted

    -- Workout data (extracted structure)
    workout_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Reel metadata (from Apify)
    reel_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Structure: {
    --   "creator": "fitcoach",
    --   "caption": "Full body HIIT...",
    --   "duration_seconds": 62,
    --   "likes": 1200
    -- }

    -- Processing metadata
    processing_method TEXT DEFAULT 'apify_transcript',
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ingested_by TEXT,  -- User ID who first ingested this reel

    -- Cache tracking
    cache_hits INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ig_reel_cache_shortcode ON instagram_reel_workout_cache(shortcode);
CREATE INDEX IF NOT EXISTS idx_ig_reel_cache_created_at ON instagram_reel_workout_cache(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ig_reel_cache_cache_hits ON instagram_reel_workout_cache(cache_hits DESC);

-- Enable Row Level Security
ALTER TABLE instagram_reel_workout_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read access (cached workouts are shared)
CREATE POLICY "Anyone can view cached instagram reel workouts"
    ON instagram_reel_workout_cache
    FOR SELECT
    USING (true);

-- RLS Policy: Service role can insert/update/delete
CREATE POLICY "Service role can insert cached instagram reel workouts"
    ON instagram_reel_workout_cache
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update cached instagram reel workouts"
    ON instagram_reel_workout_cache
    FOR UPDATE
    USING (true);

CREATE POLICY "Service role can delete cached instagram reel workouts"
    ON instagram_reel_workout_cache
    FOR DELETE
    USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ig_reel_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_ig_reel_cache_updated_at
    BEFORE UPDATE ON instagram_reel_workout_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_ig_reel_cache_updated_at();

-- RPC function for atomic cache hit increment
CREATE OR REPLACE FUNCTION increment_instagram_reel_cache_hits(p_shortcode TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE instagram_reel_workout_cache
    SET cache_hits = cache_hits + 1,
        last_accessed_at = NOW()
    WHERE shortcode = p_shortcode;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE instagram_reel_workout_cache IS 'Caches Instagram Reel workout metadata to avoid redundant Apify calls and AI processing';
COMMENT ON COLUMN instagram_reel_workout_cache.shortcode IS 'Instagram shortcode from the reel URL';
COMMENT ON COLUMN instagram_reel_workout_cache.reel_metadata IS 'Reel metadata from Apify (creator, caption, duration, likes)';
COMMENT ON COLUMN instagram_reel_workout_cache.workout_data IS 'Extracted workout structure (exercises, sets, reps, timestamps, etc.)';
COMMENT ON COLUMN instagram_reel_workout_cache.processing_method IS 'Method used to process the workout (apify_transcript, apify_caption)';
COMMENT ON COLUMN instagram_reel_workout_cache.cache_hits IS 'Number of times this cached workout has been served';
