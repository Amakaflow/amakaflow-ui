-- Create connected_calendars table for storing user's connected calendar integrations
-- Supports Runna, Apple Calendar, Google Calendar, Outlook, and custom ICS feeds

CREATE TABLE IF NOT EXISTS public.connected_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Calendar identification
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('runna', 'apple', 'google', 'outlook', 'ics_custom')),
  integration_type TEXT NOT NULL CHECK (integration_type IN ('ics_url', 'oauth', 'os_integration')),
  
  -- Configuration
  is_workout_calendar BOOLEAN DEFAULT TRUE,
  ics_url TEXT, -- For ICS feed integrations
  oauth_token_encrypted TEXT, -- For OAuth integrations (encrypted)
  
  -- Sync status
  last_sync TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'active' CHECK (sync_status IN ('active', 'error', 'paused')),
  sync_error_message TEXT,
  
  -- Metadata
  color TEXT, -- Display color for events from this calendar
  workouts_this_week INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connected_calendars_user_id 
ON public.connected_calendars(user_id);

CREATE INDEX IF NOT EXISTS idx_connected_calendars_type 
ON public.connected_calendars(type);

CREATE INDEX IF NOT EXISTS idx_connected_calendars_sync_status 
ON public.connected_calendars(sync_status);

-- Enable RLS
ALTER TABLE public.connected_calendars ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "select_own_calendars" ON public.connected_calendars
FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "insert_own_calendars" ON public.connected_calendars
FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "update_own_calendars" ON public.connected_calendars
FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "delete_own_calendars" ON public.connected_calendars
FOR DELETE USING (auth.uid()::text = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_connected_calendars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_connected_calendars_updated_at
  BEFORE UPDATE ON public.connected_calendars
  FOR EACH ROW
  EXECUTE FUNCTION update_connected_calendars_updated_at();

-- Add foreign key from workout_events to connected_calendars
ALTER TABLE public.workout_events
ADD CONSTRAINT fk_workout_events_connected_calendar
FOREIGN KEY (connected_calendar_id) 
REFERENCES public.connected_calendars(id) 
ON DELETE SET NULL;

-- Comments
COMMENT ON TABLE public.connected_calendars IS 'User connected calendar integrations (Runna, Apple, Google, etc.)';
COMMENT ON COLUMN public.connected_calendars.type IS 'Calendar provider type';
COMMENT ON COLUMN public.connected_calendars.integration_type IS 'How the calendar is connected (ics_url, oauth, os_integration)';
COMMENT ON COLUMN public.connected_calendars.is_workout_calendar IS 'Whether this calendar contains workout events';
