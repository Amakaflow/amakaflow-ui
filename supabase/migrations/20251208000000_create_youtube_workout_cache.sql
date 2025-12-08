-- Create youtube_workout_cache table for caching YouTube workout metadata
-- This table stores workout data extracted from YouTube videos to avoid
-- redundant API calls and AI processing for previously ingested videos.

CREATE TABLE IF NOT EXISTS youtube_workout_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Video identification
    video_id TEXT NOT NULL UNIQUE,  -- YouTube video ID (11 chars)
    source_url TEXT NOT NULL,       -- Original URL submitted
    normalized_url TEXT NOT NULL,   -- Normalized URL for lookups
    platform TEXT NOT NULL DEFAULT 'youtube',  -- Platform (for future expansion)

    -- Video metadata (from YouTube API)
    video_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Structure: {
    --   "title": "20 Min Full Body HIIT Workout",
    --   "channel": "MadFit",
    --   "thumbnail_url": "https://i.ytimg.com/vi/...",
    --   "duration_seconds": 1200,
    --   "published_at": "2024-03-15T00:00:00Z"
    -- }

    -- Workout data (extracted structure)
    workout_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Structure: Full workout object with title, blocks, exercises, etc.

    -- Processing metadata
    processing_method TEXT,  -- e.g., "llm_openai", "llm_anthropic", "regex_fallback"
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ingested_by TEXT,  -- User ID who first ingested this workout (optional)

    -- Cache tracking
    cache_hits INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_youtube_cache_video_id ON youtube_workout_cache(video_id);
CREATE INDEX IF NOT EXISTS idx_youtube_cache_normalized_url ON youtube_workout_cache(normalized_url);
CREATE INDEX IF NOT EXISTS idx_youtube_cache_platform ON youtube_workout_cache(platform);
CREATE INDEX IF NOT EXISTS idx_youtube_cache_created_at ON youtube_workout_cache(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_cache_cache_hits ON youtube_workout_cache(cache_hits DESC);

-- Enable Row Level Security
ALTER TABLE youtube_workout_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read access (cached workouts are shared)
-- Anyone can read cached workouts - this is the key benefit of caching
CREATE POLICY "Anyone can view cached workouts"
    ON youtube_workout_cache
    FOR SELECT
    USING (true);

-- RLS Policy: Service role can insert/update/delete
-- Only backend services with service role key can write to cache
CREATE POLICY "Service role can insert cached workouts"
    ON youtube_workout_cache
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update cached workouts"
    ON youtube_workout_cache
    FOR UPDATE
    USING (true);

CREATE POLICY "Service role can delete cached workouts"
    ON youtube_workout_cache
    FOR DELETE
    USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_youtube_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_youtube_cache_updated_at
    BEFORE UPDATE ON youtube_workout_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_youtube_cache_updated_at();

-- Comments for documentation
COMMENT ON TABLE youtube_workout_cache IS 'Caches YouTube workout metadata to avoid redundant API calls and AI processing';
COMMENT ON COLUMN youtube_workout_cache.video_id IS 'YouTube video ID (11 characters)';
COMMENT ON COLUMN youtube_workout_cache.normalized_url IS 'Normalized URL for consistent lookups (youtube.com/watch?v=VIDEO_ID)';
COMMENT ON COLUMN youtube_workout_cache.video_metadata IS 'Video metadata from YouTube (title, channel, duration, etc.)';
COMMENT ON COLUMN youtube_workout_cache.workout_data IS 'Extracted workout structure (exercises, sets, reps, etc.)';
COMMENT ON COLUMN youtube_workout_cache.processing_method IS 'Method used to process the workout (llm_openai, llm_anthropic, regex_fallback)';
COMMENT ON COLUMN youtube_workout_cache.cache_hits IS 'Number of times this cached workout has been served';
