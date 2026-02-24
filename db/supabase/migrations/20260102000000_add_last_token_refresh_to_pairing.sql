-- Add last_token_refresh column to mobile_pairing_tokens (AMA-220)
--
-- This column tracks when the JWT was last refreshed for a paired device.
-- iOS can call POST /mobile/pairing/refresh to get a new JWT without re-pairing.

ALTER TABLE mobile_pairing_tokens
ADD COLUMN IF NOT EXISTS last_token_refresh TIMESTAMPTZ;

-- Create index for efficient lookup by device_id in device_info JSONB
-- This is used by the refresh endpoint to find devices by their iOS device UUID
CREATE INDEX IF NOT EXISTS idx_pairing_tokens_device_id
ON mobile_pairing_tokens ((device_info->>'device_id'))
WHERE device_info->>'device_id' IS NOT NULL;

COMMENT ON COLUMN mobile_pairing_tokens.last_token_refresh IS
  'Timestamp when JWT was last refreshed via /mobile/pairing/refresh endpoint';
