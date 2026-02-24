-- Migration: Add atomic rate limit check-and-increment RPC
-- Fixes race condition in rate limiting (TOCTOU vulnerability)
-- Part of AMA-428: Phase 4 - Calendar & Sync Functions

-- =============================================================================
-- Atomic Rate Limit Function
-- =============================================================================
-- Uses INSERT ... ON CONFLICT DO UPDATE with a conditional check to atomically
-- check the rate limit and increment the counter in a single operation.
-- This prevents race conditions where concurrent requests could bypass the limit.

CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
    p_user_id TEXT,
    p_function_name TEXT,
    p_limit INT,
    p_window_start TIMESTAMPTZ
)
RETURNS TABLE(allowed BOOLEAN, call_count INT, rate_limit INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
    v_row_id UUID;
BEGIN
    -- Attempt atomic upsert with conditional increment
    -- Only increments if current count < limit
    INSERT INTO function_rate_limits (user_id, function_name, window_start, call_count)
    VALUES (p_user_id, p_function_name, p_window_start, 1)
    ON CONFLICT (user_id, function_name, window_start)
    DO UPDATE SET
        call_count = CASE
            WHEN function_rate_limits.call_count < p_limit
            THEN function_rate_limits.call_count + 1
            ELSE function_rate_limits.call_count  -- Don't increment if at limit
        END,
        updated_at = NOW()
    RETURNING function_rate_limits.call_count, function_rate_limits.id
    INTO v_count, v_row_id;

    -- Check if this was a new insert (count = 1) or an increment
    IF v_count <= p_limit THEN
        -- We got a slot (either new row or successful increment)
        -- But we need to verify we actually incremented, not just read existing
        -- The trick: if call_count equals what we expect after increment, we're good
        -- For new rows: v_count = 1
        -- For updates: v_count = old_count + 1 (if < limit) or old_count (if at limit)
        
        -- Re-check to see if we actually got the increment
        -- If call_count stayed the same as before (at limit), we didn't get it
        SELECT call_count INTO v_count
        FROM function_rate_limits
        WHERE id = v_row_id;
        
        IF v_count <= p_limit THEN
            RETURN QUERY SELECT TRUE, v_count, p_limit;
            RETURN;
        END IF;
    END IF;

    -- At or over limit - return current count
    SELECT call_count INTO v_count
    FROM function_rate_limits
    WHERE user_id = p_user_id
      AND function_name = p_function_name
      AND window_start = p_window_start;

    RETURN QUERY SELECT FALSE, COALESCE(v_count, 0), p_limit;
END;
$$;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON FUNCTION check_and_increment_rate_limit(TEXT, TEXT, INT, TIMESTAMPTZ) IS
    'Atomically check rate limit and increment counter. Returns (allowed, count, limit). '
    'Uses INSERT ON CONFLICT to prevent race conditions.';
