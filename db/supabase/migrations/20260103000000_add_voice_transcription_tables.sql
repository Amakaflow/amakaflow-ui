-- Migration: Add voice transcription settings and corrections tables (AMA-229)
-- Multi-provider transcription support with personal dictionary

-- User voice settings (synced across devices)
CREATE TABLE IF NOT EXISTS user_voice_settings (
    user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'smart' CHECK (provider IN ('whisperkit', 'deepgram', 'assemblyai', 'smart')),
    cloud_fallback_enabled BOOLEAN NOT NULL DEFAULT true,
    accent_region TEXT NOT NULL DEFAULT 'en-US',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Personal dictionary corrections (misheard words → user corrections)
CREATE TABLE IF NOT EXISTS user_voice_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    misheard TEXT NOT NULL,        -- What ASR heard wrong
    corrected TEXT NOT NULL,       -- What user corrected it to
    frequency INT NOT NULL DEFAULT 1,  -- How often this correction was made
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, misheard)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_voice_corrections_user_id ON user_voice_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_corrections_misheard ON user_voice_corrections(user_id, misheard);

-- Enable RLS
ALTER TABLE user_voice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_voice_corrections ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_voice_settings
CREATE POLICY "Users can view own voice settings"
    ON user_voice_settings FOR SELECT
    USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own voice settings"
    ON user_voice_settings FOR INSERT
    WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own voice settings"
    ON user_voice_settings FOR UPDATE
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own voice settings"
    ON user_voice_settings FOR DELETE
    USING (user_id = auth.uid()::text);

-- RLS policies for user_voice_corrections
CREATE POLICY "Users can view own voice corrections"
    ON user_voice_corrections FOR SELECT
    USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own voice corrections"
    ON user_voice_corrections FOR INSERT
    WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own voice corrections"
    ON user_voice_corrections FOR UPDATE
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own voice corrections"
    ON user_voice_corrections FOR DELETE
    USING (user_id = auth.uid()::text);

-- Service role bypass policies (for backend API)
CREATE POLICY "Service role can manage all voice settings"
    ON user_voice_settings FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all voice corrections"
    ON user_voice_corrections FOR ALL
    USING (auth.role() = 'service_role');

-- Updated_at trigger function (reuse existing or create)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_voice_settings_updated_at
    BEFORE UPDATE ON user_voice_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_voice_corrections_updated_at
    BEFORE UPDATE ON user_voice_corrections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE user_voice_settings IS 'User preferences for voice transcription (AMA-229)';
COMMENT ON TABLE user_voice_corrections IS 'Personal dictionary of ASR corrections (AMA-229)';
COMMENT ON COLUMN user_voice_settings.provider IS 'Transcription provider: whisperkit (on-device), deepgram, assemblyai, or smart (auto)';
COMMENT ON COLUMN user_voice_settings.cloud_fallback_enabled IS 'Enable cloud fallback when on-device confidence is low';
COMMENT ON COLUMN user_voice_settings.accent_region IS 'Language/accent code: en-US, en-GB, en-AU, etc.';
COMMENT ON COLUMN user_voice_corrections.misheard IS 'The incorrectly transcribed text';
COMMENT ON COLUMN user_voice_corrections.corrected IS 'The user-provided correction';
COMMENT ON COLUMN user_voice_corrections.frequency IS 'Number of times this correction was made';
