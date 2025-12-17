-- Mobile Pairing Tokens table for iOS Companion App authentication (AMA-61)
-- Enables QR code / short code pairing between web app and iOS app

CREATE TABLE IF NOT EXISTS mobile_pairing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User reference (Clerk user ID)
  clerk_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Token data
  token VARCHAR(64) UNIQUE NOT NULL,       -- Secure random token (32 bytes hex)
  short_code VARCHAR(8) UNIQUE NOT NULL,   -- Human-readable 6-char alphanumeric

  -- Expiration and usage tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,         -- 5 minutes from creation
  used_at TIMESTAMPTZ NULL,                -- NULL until paired, timestamp when paired

  -- Device info captured on successful pairing
  device_info JSONB NULL                   -- { model, os_version, app_version, device_id }
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_mpt_clerk_user ON mobile_pairing_tokens(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_mpt_token ON mobile_pairing_tokens(token);
CREATE INDEX IF NOT EXISTS idx_mpt_short_code ON mobile_pairing_tokens(short_code);
CREATE INDEX IF NOT EXISTS idx_mpt_expires ON mobile_pairing_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_mpt_unused ON mobile_pairing_tokens(used_at) WHERE used_at IS NULL;

-- Enable Row Level Security
ALTER TABLE mobile_pairing_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own pairing tokens
CREATE POLICY "Users can view own pairing tokens"
  ON mobile_pairing_tokens
  FOR SELECT
  USING (auth.uid()::text = clerk_user_id);

-- Policy: Users can create pairing tokens for themselves
CREATE POLICY "Users can create own pairing tokens"
  ON mobile_pairing_tokens
  FOR INSERT
  WITH CHECK (auth.uid()::text = clerk_user_id);

-- Policy: Users can delete their own pairing tokens
CREATE POLICY "Users can delete own pairing tokens"
  ON mobile_pairing_tokens
  FOR DELETE
  USING (auth.uid()::text = clerk_user_id);

-- Policy: Service role has full access (for pairing endpoint validation)
CREATE POLICY "Service role full access"
  ON mobile_pairing_tokens
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to clean up expired tokens (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_pairing_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM mobile_pairing_tokens
  WHERE expires_at < NOW()
  OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '24 hours');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE mobile_pairing_tokens IS 'Stores temporary pairing tokens for iOS Companion App authentication';
COMMENT ON COLUMN mobile_pairing_tokens.token IS 'Secure 64-character hex token for QR code';
COMMENT ON COLUMN mobile_pairing_tokens.short_code IS 'Human-readable 6-character code for manual entry';
COMMENT ON COLUMN mobile_pairing_tokens.expires_at IS 'Token expires 5 minutes after creation';
COMMENT ON COLUMN mobile_pairing_tokens.used_at IS 'Timestamp when token was successfully used to pair';
COMMENT ON COLUMN mobile_pairing_tokens.device_info IS 'iOS device metadata captured during pairing';
COMMENT ON FUNCTION cleanup_expired_pairing_tokens IS 'Removes expired and old used tokens';