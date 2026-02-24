-- Add APNs push token column to mobile_pairing_tokens (AMA-567 Phase D)
-- Stores the Apple Push Notification device token for each paired device.
-- This token is separate from the pairing JWT — it's the delivery address
-- for silent push notifications to wake the iOS app for background sync.

ALTER TABLE mobile_pairing_tokens
  ADD COLUMN IF NOT EXISTS apns_token TEXT NULL;

-- Index for looking up all APNs tokens for a user (used by push service)
CREATE INDEX IF NOT EXISTS idx_mpt_apns_token_by_user
  ON mobile_pairing_tokens(clerk_user_id)
  WHERE apns_token IS NOT NULL AND used_at IS NOT NULL;

COMMENT ON COLUMN mobile_pairing_tokens.apns_token
  IS 'Apple Push Notification Service device token (hex string), registered after pairing';
