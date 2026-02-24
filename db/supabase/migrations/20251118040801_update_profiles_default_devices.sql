-- Update profiles table to use empty array as default for selected_devices
-- This ensures new users must complete their profile
ALTER TABLE profiles 
  ALTER COLUMN selected_devices SET DEFAULT ARRAY[]::TEXT[];

-- Update the trigger function to insert empty array for selected_devices
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, selected_devices)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    ARRAY[]::TEXT[] -- Empty array - user must complete profile
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

