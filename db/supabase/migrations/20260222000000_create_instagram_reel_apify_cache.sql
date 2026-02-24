-- Instagram Reel Apify raw response cache
-- Stores the raw Apify fetch result (transcript, caption, duration, etc.) keyed by shortcode.
-- Purpose: avoid re-calling Apify when only the LLM prompt has changed.
-- To force a fresh Apify fetch, delete the row. To force LLM re-extraction only,
-- delete from instagram_reel_workout_cache (leave this table intact).

CREATE TABLE IF NOT EXISTS instagram_reel_apify_cache (
    shortcode         TEXT PRIMARY KEY,
    source_url        TEXT NOT NULL,
    raw_data          JSONB NOT NULL,
    fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for recency queries / cache management
CREATE INDEX IF NOT EXISTS idx_instagram_reel_apify_cache_fetched_at
    ON instagram_reel_apify_cache (fetched_at DESC);

-- RLS: service role only (this table is internal infra, not user-scoped)
ALTER TABLE instagram_reel_apify_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "service_role_only" ON instagram_reel_apify_cache
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
