-- Migration: Fix ambiguous call_count column reference in check_and_increment_rate_limit
-- The function returns TABLE(allowed BOOLEAN, call_count INT, rate_limit INT), which
-- creates an output variable named call_count that conflicts with the table column.
-- Fix: qualify all call_count references with the table name.

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
    INSERT INTO function_rate_limits (user_id, function_name, window_start, call_count)
    VALUES (p_user_id, p_function_name, p_window_start, 1)
    ON CONFLICT (user_id, function_name, window_start)
    DO UPDATE SET
        call_count = CASE
            WHEN function_rate_limits.call_count < p_limit
            THEN function_rate_limits.call_count + 1
            ELSE function_rate_limits.call_count
        END,
        updated_at = NOW()
    RETURNING function_rate_limits.call_count, function_rate_limits.id
    INTO v_count, v_row_id;

    IF v_count <= p_limit THEN
        SELECT function_rate_limits.call_count INTO v_count
        FROM function_rate_limits
        WHERE id = v_row_id;

        IF v_count <= p_limit THEN
            RETURN QUERY SELECT TRUE, v_count, p_limit;
            RETURN;
        END IF;
    END IF;

    SELECT function_rate_limits.call_count INTO v_count
    FROM function_rate_limits
    WHERE user_id = p_user_id
      AND function_name = p_function_name
      AND window_start = p_window_start;

    RETURN QUERY SELECT FALSE, COALESCE(v_count, 0), p_limit;
END;
$$;

COMMENT ON FUNCTION check_and_increment_rate_limit(TEXT, TEXT, INT, TIMESTAMPTZ) IS
    'Atomically check rate limit and increment counter. Returns (allowed, count, limit). '
    'Uses INSERT ON CONFLICT to prevent race conditions.';
