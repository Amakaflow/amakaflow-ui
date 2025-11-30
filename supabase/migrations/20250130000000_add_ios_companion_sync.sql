-- Add iOS Companion App sync tracking column to follow_along_workouts
ALTER TABLE follow_along_workouts 
ADD COLUMN IF NOT EXISTS ios_companion_synced_at TIMESTAMPTZ;

-- Add follow_along_url column to follow_along_steps for per-step video references
ALTER TABLE follow_along_steps
ADD COLUMN IF NOT EXISTS follow_along_url TEXT;

-- Add carousel_position for Instagram carousels
ALTER TABLE follow_along_steps
ADD COLUMN IF NOT EXISTS carousel_position INTEGER;

-- Add video_start_time_sec for YouTube/Vimeo timestamp support
ALTER TABLE follow_along_steps
ADD COLUMN IF NOT EXISTS video_start_time_sec INTEGER;
