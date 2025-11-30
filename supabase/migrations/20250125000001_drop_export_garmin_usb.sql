-- Drop export_garmin_usb column from profiles table
-- This column is no longer needed as we use "garmin_usb" in selected_devices array instead
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS export_garmin_usb;
