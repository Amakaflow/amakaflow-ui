-- Add atomic increment function for TTS daily character usage
-- Part of AMA-442: Extend Voice Infrastructure for Chat Assistant (TTS)
-- Fixes race condition in concurrent TTS requests

-- Create function for atomic increment of daily chars with date reset
CREATE OR REPLACE FUNCTION increment_tts_daily_chars(
    p_user_id TEXT,
    p_chars INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_total INTEGER;
BEGIN
    -- Upsert with atomic increment, resetting if it's a new day
    INSERT INTO user_voice_settings (
        user_id,
        tts_daily_chars_used,
        tts_daily_reset_date
    )
    VALUES (
        p_user_id,
        p_chars,
        CURRENT_DATE
    )
    ON CONFLICT (user_id) DO UPDATE SET
        -- Reset to p_chars if new day, otherwise increment atomically
        tts_daily_chars_used = CASE
            WHEN user_voice_settings.tts_daily_reset_date < CURRENT_DATE
                OR user_voice_settings.tts_daily_reset_date IS NULL
            THEN p_chars
            ELSE user_voice_settings.tts_daily_chars_used + p_chars
        END,
        tts_daily_reset_date = CURRENT_DATE
    RETURNING tts_daily_chars_used INTO v_new_total;

    RETURN v_new_total;
END;
$$;

-- Grant execute to authenticated users (service role)
GRANT EXECUTE ON FUNCTION increment_tts_daily_chars(TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION increment_tts_daily_chars IS
'Atomically increments TTS daily character usage, resetting if new day. Returns new total.';
