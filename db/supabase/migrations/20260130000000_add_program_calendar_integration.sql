-- ============================================================================
-- AMA-469: Calendar Integration for Program Workouts
--
-- Adds columns to workout_events table to link calendar events to training
-- programs. When a program is activated, workouts are scheduled on the
-- user's calendar with these references.
-- ============================================================================

-- Add program-related columns to workout_events
ALTER TABLE workout_events
ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES training_programs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS program_workout_id UUID REFERENCES program_workouts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS program_week_number INTEGER;

-- Update source constraint to include 'training_program'
-- First, drop the existing constraint
ALTER TABLE workout_events DROP CONSTRAINT IF EXISTS workout_events_source_check;

-- Then add the updated constraint with 'training_program' included
ALTER TABLE workout_events ADD CONSTRAINT workout_events_source_check CHECK (
    source = ANY (ARRAY[
        'manual'::text,
        'gym_manual_sync'::text,
        'connected_calendar'::text,
        'smart_planner'::text,
        'template'::text,
        'gym_class'::text,
        'amaka'::text,
        'instagram'::text,
        'tiktok'::text,
        'garmin'::text,
        'runna'::text,
        'training_program'::text
    ])
);

-- Create partial index for efficient program event queries
-- Only indexes rows where program_id is not null
CREATE INDEX IF NOT EXISTS idx_workout_events_program
    ON workout_events(program_id)
    WHERE program_id IS NOT NULL;

-- Add composite index for querying program events by user and program
CREATE INDEX IF NOT EXISTS idx_workout_events_user_program
    ON workout_events(user_id, program_id)
    WHERE program_id IS NOT NULL;

-- Add index for querying by program_workout_id (for webhook lookups)
CREATE INDEX IF NOT EXISTS idx_workout_events_program_workout
    ON workout_events(program_workout_id)
    WHERE program_workout_id IS NOT NULL;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN workout_events.program_id IS 'Reference to training program this event belongs to (NULL for non-program events)';
COMMENT ON COLUMN workout_events.program_workout_id IS 'Reference to the specific program_workout this event represents';
COMMENT ON COLUMN workout_events.program_week_number IS 'Week number within the program (1-indexed) for this event';
