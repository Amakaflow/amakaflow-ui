-- Migration: Add atomic AI request limit increment RPC
-- Fixes race condition in AI rate limiting (TOCTOU vulnerability) (AMA-496)

-- =============================================================================
-- Add last_request_at column if it doesn't exist
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_request_limits'
        AND column_name = 'last_request_at'
    ) THEN
        ALTER TABLE ai_request_limits
        ADD COLUMN last_request_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- =============================================================================
-- Atomic AI Request Limit Increment Function
-- =============================================================================
-- Uses INSERT ... ON CONFLICT DO UPDATE to atomically increment the counter.
-- This prevents race conditions where concurrent requests could bypass the limit.
-- Returns the new count so the caller can check against the limit.

CREATE OR REPLACE FUNCTION increment_ai_request_limit(
    p_user_id TEXT,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(new_count INTEGER, was_created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_count INTEGER;
    v_was_created BOOLEAN := FALSE;
BEGIN
    -- Attempt atomic upsert
    -- If row exists: increment count
    -- If row doesn't exist: insert with count = 1
    INSERT INTO ai_request_limits (user_id, request_date, request_count, last_request_at)
    VALUES (p_user_id, p_date, 1, NOW())
    ON CONFLICT (user_id, request_date)
    DO UPDATE SET
        request_count = ai_request_limits.request_count + 1,
        last_request_at = NOW(),
        updated_at = NOW()
    RETURNING ai_request_limits.request_count INTO v_new_count;

    -- Check if this was a new insert (count = 1)
    IF v_new_count = 1 THEN
        v_was_created := TRUE;
    END IF;

    RETURN QUERY SELECT v_new_count, v_was_created;
END;
$$;

-- =============================================================================
-- Permissions
-- =============================================================================
-- Only service_role should call this function (backend only, not client-side)
REVOKE EXECUTE ON FUNCTION increment_ai_request_limit(TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_ai_request_limit(TEXT, DATE) TO service_role;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON FUNCTION increment_ai_request_limit(TEXT, DATE) IS
    'Atomically increment AI request count for a user on a given date. '
    'Returns (new_count, was_created). Uses INSERT ON CONFLICT to prevent race conditions.';

COMMENT ON COLUMN ai_request_limits.last_request_at IS
    'Timestamp of the most recent AI request for this user on this date';
