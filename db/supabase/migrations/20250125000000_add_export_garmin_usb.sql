-- Add export_garmin_usb boolean column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS export_garmin_usb boolean NOT NULL DEFAULT false;
