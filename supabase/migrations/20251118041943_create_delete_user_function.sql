-- Create function to allow users to delete their own account
-- This function uses SECURITY DEFINER to allow deletion from auth.users
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get the current user's ID
  user_id := auth.uid();
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Delete the user from auth.users
  -- This will cascade delete the profile due to ON DELETE CASCADE
  DELETE FROM auth.users WHERE id = user_id;
  
  -- If we get here, deletion was successful
  RETURN;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

