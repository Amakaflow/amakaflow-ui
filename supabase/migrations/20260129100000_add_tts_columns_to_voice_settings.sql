-- Migration: Add TTS columns to user_voice_settings table (AMA-442)
-- Extends voice settings with text-to-speech preferences for chat assistant

-- Add TTS columns to existing user_voice_settings table
DO $$
BEGIN
    -- TTS enabled flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user_voice_settings' AND column_name = 'tts_enabled') THEN
        ALTER TABLE user_voice_settings
        ADD COLUMN tts_enabled BOOLEAN DEFAULT true;
    END IF;

    -- Voice ID (ElevenLabs voice ID, NULL for default)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user_voice_settings' AND column_name = 'tts_voice_id') THEN
        ALTER TABLE user_voice_settings
        ADD COLUMN tts_voice_id TEXT DEFAULT NULL;
    END IF;

    -- Speech speed (0.25x to 4.0x)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user_voice_settings' AND column_name = 'tts_speed') THEN
        ALTER TABLE user_voice_settings
        ADD COLUMN tts_speed NUMERIC(3,2) DEFAULT 1.0 CHECK (tts_speed BETWEEN 0.25 AND 4.0);
    END IF;

    -- Speech pitch (0.5x to 2.0x)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user_voice_settings' AND column_name = 'tts_pitch') THEN
        ALTER TABLE user_voice_settings
        ADD COLUMN tts_pitch NUMERIC(3,2) DEFAULT 1.0 CHECK (tts_pitch BETWEEN 0.5 AND 2.0);
    END IF;

    -- Auto-play responses flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user_voice_settings' AND column_name = 'auto_play_responses') THEN
        ALTER TABLE user_voice_settings
        ADD COLUMN auto_play_responses BOOLEAN DEFAULT true;
    END IF;

    -- Daily character usage counter
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user_voice_settings' AND column_name = 'tts_daily_chars_used') THEN
        ALTER TABLE user_voice_settings
        ADD COLUMN tts_daily_chars_used INTEGER DEFAULT 0;
    END IF;

    -- Date for daily reset tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user_voice_settings' AND column_name = 'tts_daily_reset_date') THEN
        ALTER TABLE user_voice_settings
        ADD COLUMN tts_daily_reset_date DATE DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- Add column comments for documentation
COMMENT ON COLUMN user_voice_settings.tts_enabled IS 'Whether TTS is enabled for chat responses';
COMMENT ON COLUMN user_voice_settings.tts_voice_id IS 'ElevenLabs voice ID, NULL for default (Rachel)';
COMMENT ON COLUMN user_voice_settings.tts_speed IS 'Speech rate multiplier (0.25-4.0, default 1.0)';
COMMENT ON COLUMN user_voice_settings.tts_pitch IS 'Speech pitch multiplier (0.5-2.0, default 1.0)';
COMMENT ON COLUMN user_voice_settings.auto_play_responses IS 'Automatically play TTS when response arrives';
COMMENT ON COLUMN user_voice_settings.tts_daily_chars_used IS 'Characters synthesized today (resets daily)';
COMMENT ON COLUMN user_voice_settings.tts_daily_reset_date IS 'Date for tracking daily character limit reset';
