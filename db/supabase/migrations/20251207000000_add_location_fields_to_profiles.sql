-- Add location fields to profiles table
-- These fields help with location-based features like nearby gym suggestions

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;

-- Create index on zip_code for faster lookups
CREATE INDEX IF NOT EXISTS profiles_zip_code_idx ON profiles(zip_code);

-- Add comment to document the new fields
COMMENT ON COLUMN profiles.zip_code IS 'User zip/postal code for location-based features';
COMMENT ON COLUMN profiles.address IS 'User street address';
COMMENT ON COLUMN profiles.city IS 'User city name';
COMMENT ON COLUMN profiles.state IS 'User state/province (2-letter code recommended)';
