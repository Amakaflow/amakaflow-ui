-- Create video_workout_cache table for caching workout metadata from multiple platforms
-- This table stores video data extracted from YouTube, Instagram, TikTok, etc.
-- to avoid redundant API calls and processing for previously ingested videos.

CREATE TABLE IF NOT EXISTS video_workout_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Video identification
    video_id TEXT NOT NULL,              -- Platform-specific video ID
    platform TEXT NOT NULL,              -- Platform: youtube, instagram, tiktok
    source_url TEXT NOT NULL,            -- Original URL submitted
    normalized_url TEXT NOT NULL,        -- Normalized URL for lookups

    -- oEmbed data (fetched from platform's oEmbed API)
    oembed_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Structure: {
    --   "title": "Hip Mobility - 4 Planes of Motion",
    --   "author_name": "@protein.papi_",
    --   "author_url": "https://instagram.com/protein.papi_",
    --   "thumbnail_url": "https://...",
    --   "thumbnail_width": 640,
    --   "thumbnail_height": 640,
    --   "success": true,
    --   "fetched_at": "2025-12-08T00:00:00Z"
    -- }

    -- Video metadata (additional info not in oEmbed)
    video_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Structure: {
    --   "duration_seconds": 45,
    --   "post_type": "reel",
    --   "published_at": "2024-03-15T00:00:00Z"
    -- }

    -- Workout data (extracted or manually entered)
    workout_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Structure: {
    --   "title": "Hip Mobility Routine",
    --   "exercises": [...],
    --   "source_link": "instagram.com/reel/ABC123"
    -- }

    -- Processing metadata
    processing_method TEXT,  -- e.g., "manual_with_oembed", "llm_openai", "llm_anthropic", "vision_ai"
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ingested_by TEXT,        -- User ID who first ingested this workout (optional)

    -- Cache tracking
    cache_hits INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: one entry per video_id + platform combination
    CONSTRAINT video_workout_cache_video_platform_unique UNIQUE (video_id, platform)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_video_cache_video_id ON video_workout_cache(video_id);
CREATE INDEX IF NOT EXISTS idx_video_cache_platform ON video_workout_cache(platform);
CREATE INDEX IF NOT EXISTS idx_video_cache_normalized_url ON video_workout_cache(normalized_url);
CREATE INDEX IF NOT EXISTS idx_video_cache_video_platform ON video_workout_cache(video_id, platform);
CREATE INDEX IF NOT EXISTS idx_video_cache_created_at ON video_workout_cache(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_cache_cache_hits ON video_workout_cache(cache_hits DESC);

-- Enable Row Level Security
ALTER TABLE video_workout_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read access (cached videos are shared)
-- Anyone can read cached videos - this is the key benefit of caching
CREATE POLICY "Anyone can view cached videos"
    ON video_workout_cache
    FOR SELECT
    USING (true);

-- RLS Policy: Service role can insert/update/delete
-- Only backend services with service role key can write to cache
CREATE POLICY "Service role can insert cached videos"
    ON video_workout_cache
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update cached videos"
    ON video_workout_cache
    FOR UPDATE
    USING (true);

CREATE POLICY "Service role can delete cached videos"
    ON video_workout_cache
    FOR DELETE
    USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_video_cache_updated_at
    BEFORE UPDATE ON video_workout_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_video_cache_updated_at();

-- Comments for documentation
COMMENT ON TABLE video_workout_cache IS 'Caches video workout metadata from multiple platforms (YouTube, Instagram, TikTok) to avoid redundant processing';
COMMENT ON COLUMN video_workout_cache.video_id IS 'Platform-specific video ID (YouTube: 11 chars, Instagram: shortcode, TikTok: numeric ID)';
COMMENT ON COLUMN video_workout_cache.platform IS 'Video platform: youtube, instagram, or tiktok';
COMMENT ON COLUMN video_workout_cache.normalized_url IS 'Normalized URL for consistent lookups (e.g., instagram.com/reel/SHORTCODE)';
COMMENT ON COLUMN video_workout_cache.oembed_data IS 'oEmbed response data (thumbnail, title, author, etc.)';
COMMENT ON COLUMN video_workout_cache.video_metadata IS 'Additional video metadata (duration, post type, etc.)';
COMMENT ON COLUMN video_workout_cache.workout_data IS 'Extracted or manually entered workout structure';
COMMENT ON COLUMN video_workout_cache.processing_method IS 'How the workout was processed (manual_with_oembed, llm_openai, vision_ai, etc.)';
COMMENT ON COLUMN video_workout_cache.cache_hits IS 'Number of times this cached video has been served';
