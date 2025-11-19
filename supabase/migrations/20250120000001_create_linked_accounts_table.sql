-- Create linked_accounts table for storing connected third-party accounts
CREATE TABLE IF NOT EXISTS linked_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('strava', 'relive', 'trainingPeaks', 'appleHealth', 'garmin', 'amazfit')),
  external_id TEXT NOT NULL, -- e.g., Strava athlete ID
  external_username TEXT,
  access_token_encrypted TEXT, -- Encrypted access token (encrypted by backend)
  refresh_token_encrypted TEXT, -- Encrypted refresh token (encrypted by backend)
  expires_at BIGINT, -- Unix timestamp
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  permissions TEXT[] DEFAULT ARRAY['read_activities', 'write_activities'],
  metadata JSONB, -- Additional provider-specific data
  UNIQUE(profile_id, provider) -- One connection per provider per profile
);

-- Enable Row Level Security
ALTER TABLE linked_accounts ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can read their own linked accounts
-- Note: Since we're using Clerk authentication, we validate in the application layer
CREATE POLICY "Users can view own linked accounts"
  ON linked_accounts FOR SELECT
  USING (true); -- Application layer validates access

-- Create policy: Users can insert their own linked accounts
CREATE POLICY "Users can insert own linked accounts"
  ON linked_accounts FOR INSERT
  WITH CHECK (true); -- Application layer validates access

-- Create policy: Users can update their own linked accounts
CREATE POLICY "Users can update own linked accounts"
  ON linked_accounts FOR UPDATE
  USING (true); -- Application layer validates access

-- Create policy: Users can delete their own linked accounts
CREATE POLICY "Users can delete own linked accounts"
  ON linked_accounts FOR DELETE
  USING (true); -- Application layer validates access

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS linked_accounts_profile_id_idx ON linked_accounts(profile_id);
CREATE INDEX IF NOT EXISTS linked_accounts_provider_idx ON linked_accounts(provider);
CREATE INDEX IF NOT EXISTS linked_accounts_external_id_idx ON linked_accounts(external_id);

-- Create function to get linked account status (for easier querying)
CREATE OR REPLACE FUNCTION get_linked_account_status(p_profile_id TEXT, p_provider TEXT)
RETURNS TABLE (
  connected BOOLEAN,
  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  expires_at BIGINT,
  external_id TEXT,
  external_username TEXT,
  permissions TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as connected,
    la.connected_at,
    la.last_sync_at,
    la.expires_at,
    la.external_id,
    la.external_username,
    la.permissions
  FROM linked_accounts la
  WHERE la.profile_id = p_profile_id 
    AND la.provider = p_provider
  LIMIT 1;
  
  -- If no row found, return disconnected status
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE as connected,
      NULL::TIMESTAMPTZ as connected_at,
      NULL::TIMESTAMPTZ as last_sync_at,
      NULL::BIGINT as expires_at,
      NULL::TEXT as external_id,
      NULL::TEXT as external_username,
      ARRAY[]::TEXT[] as permissions;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

