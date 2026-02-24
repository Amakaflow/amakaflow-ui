-- Migration: Create function_rate_limits table for per-function rate limiting
-- Part of AMA-428: Phase 4 - Calendar & Sync Functions

-- =============================================================================
-- Function Rate Limits Table
-- =============================================================================
-- Tracks per-function rate limits (e.g., sync operations limited to 3/hour).
-- Separate from monthly chat limits in ai_request_limits table.

CREATE TABLE function_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    function_name TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    call_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: one row per user per function per time window
    CONSTRAINT unique_user_function_window UNIQUE (user_id, function_name, window_start)
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Primary lookup: user + function + time window
CREATE INDEX idx_function_rate_limits_user_function
    ON function_rate_limits(user_id, function_name, window_start DESC);

-- Cleanup index for old windows (for periodic cleanup jobs)
CREATE INDEX idx_function_rate_limits_window_start
    ON function_rate_limits(window_start);

-- =============================================================================
-- Automatic updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_function_rate_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_function_rate_limits_updated_at
    BEFORE UPDATE ON function_rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_function_rate_limits_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE function_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can view their own rate limit data
CREATE POLICY "Users can view own rate limits"
    ON function_rate_limits
    FOR SELECT
    USING (auth.uid()::text = user_id);

-- Service role has full access (for chat-api backend operations)
CREATE POLICY "Service role full access"
    ON function_rate_limits
    FOR ALL
    USING (auth.role() = 'service_role');

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE function_rate_limits IS
    'Per-function rate limiting for sync operations (e.g., Strava sync 3/hour)';
COMMENT ON COLUMN function_rate_limits.function_name IS
    'Name of the rate-limited function (e.g., sync_strava, sync_garmin)';
COMMENT ON COLUMN function_rate_limits.window_start IS
    'Start of the rate limit window (truncated to hour for hourly limits)';
COMMENT ON COLUMN function_rate_limits.call_count IS
    'Number of calls made in this window';
