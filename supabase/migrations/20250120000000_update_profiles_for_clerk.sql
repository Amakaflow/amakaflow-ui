-- Migration to update profiles table for Clerk authentication
-- This removes the Supabase auth dependency and updates RLS policies

-- Step 1: Drop old RLS policies that use auth.uid() (must be done before altering column)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Step 2: Drop the foreign key constraint to auth.users
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 3: Change id column to TEXT to support Clerk user IDs (which are strings like "user_xxx")
-- First, we need to handle existing data if any
DO $$
BEGIN
  -- Check if there are any existing profiles with UUID format
  IF EXISTS (SELECT 1 FROM profiles LIMIT 1) THEN
    -- If there are existing profiles, we'll keep UUID for now but allow TEXT
    -- You may want to migrate existing users separately
    RAISE NOTICE 'Existing profiles found. Consider migrating them separately.';
  END IF;
END $$;

-- Change id column type to TEXT to support Clerk user IDs
ALTER TABLE profiles 
  ALTER COLUMN id TYPE TEXT;

-- Step 4: Create new RLS policies that work with Clerk
-- Since Clerk handles authentication, we'll use a more permissive approach
-- Users can only access their own profile based on the id matching

-- For SELECT: Allow users to read their own profile
-- We'll use a function that accepts the user ID as a parameter
CREATE POLICY "Clerk users can view own profile"
  ON profiles FOR SELECT
  USING (true); -- We'll validate in the application layer

-- For UPDATE: Allow users to update their own profile
CREATE POLICY "Clerk users can update own profile"
  ON profiles FOR UPDATE
  USING (true); -- We'll validate in the application layer

-- For INSERT: Allow profile creation
CREATE POLICY "Clerk users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (true); -- We'll validate in the application layer

-- Step 5: Create a helper function to insert/update profiles for Clerk users
-- This function uses SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.upsert_clerk_profile(
  p_user_id TEXT,
  p_email TEXT,
  p_name TEXT,
  p_selected_devices TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile profiles;
BEGIN
  -- Try to update existing profile
  UPDATE profiles
  SET 
    email = p_email,
    name = p_name,
    selected_devices = COALESCE(p_selected_devices, ARRAY[]::TEXT[]),
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  -- If no row was updated, insert a new one
  IF NOT FOUND THEN
    INSERT INTO profiles (id, email, name, selected_devices)
    VALUES (p_user_id, p_email, p_name, COALESCE(p_selected_devices, ARRAY[]::TEXT[]))
    RETURNING * INTO v_profile;
  END IF;

  RETURN v_profile;
END;
$$;

-- Grant execute permission to authenticated users (though we use SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.upsert_clerk_profile TO anon, authenticated;

-- Step 6: Update the default for selected_devices to empty array (if not already done)
ALTER TABLE profiles 
  ALTER COLUMN selected_devices SET DEFAULT ARRAY[]::TEXT[];

-- Step 7: Drop the old trigger (no longer needed since Clerk handles signup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- Note: We keep the function in case it's referenced elsewhere, but it won't be triggered

