-- Create helper functions if they don't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_anchor_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_anchor = true AND NEW.anchor_type = 'none' THEN
        NEW.anchor_type = 'soft';
    END IF;
    IF NEW.anchor_type != 'none' THEN
        NEW.is_anchor = true;
    END IF;
    IF NEW.anchor_type = 'none' THEN
        NEW.is_anchor = false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create workout_events table
CREATE TABLE public.workout_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    title text NOT NULL,
    source text NULL,
    date date NOT NULL,
    start_time time WITHOUT time zone NULL,
    end_time time WITHOUT time zone NULL,
    type text NULL,
    json_payload jsonb NULL,
    status text NULL DEFAULT 'planned'::text,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    is_anchor boolean NULL DEFAULT false,
    primary_muscle text NULL,
    intensity integer NULL DEFAULT 1,
    connected_calendar_type text NULL,
    external_event_url text NULL,
    recurrence_rule text NULL,
    connected_calendar_id uuid NULL,
    block_type text NULL DEFAULT 'workout'::text,
    anchor_type text NULL DEFAULT 'none'::text,
    load_score integer NULL DEFAULT 0,
    skipped_dates jsonb NULL DEFAULT '[]'::jsonb,
    
    CONSTRAINT workout_events_pkey PRIMARY KEY (id),
    CONSTRAINT fk_workout_events_user_id FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT workout_events_connected_calendar_type_check CHECK (
        connected_calendar_type = ANY (ARRAY['runna'::text, 'apple'::text, 'google'::text, 'outlook'::text, 'ics_custom'::text])
    ),
    CONSTRAINT workout_events_intensity_check CHECK (intensity >= 0 AND intensity <= 3),
    CONSTRAINT workout_events_primary_muscle_check CHECK (
        primary_muscle = ANY (ARRAY['upper'::text, 'lower'::text, 'full_body'::text, 'core'::text, 'none'::text])
    ),
    CONSTRAINT workout_events_source_check CHECK (
        source = ANY (ARRAY['manual'::text, 'gym_manual_sync'::text, 'connected_calendar'::text, 'smart_planner'::text, 'template'::text, 'gym_class'::text, 'amaka'::text, 'instagram'::text, 'tiktok'::text, 'garmin'::text, 'runna'::text])
    ),
    CONSTRAINT workout_events_status_check CHECK (status = ANY (ARRAY['planned'::text, 'completed'::text])),
    CONSTRAINT workout_events_type_check CHECK (
        type = ANY (ARRAY['run'::text, 'strength'::text, 'hyrox'::text, 'class'::text, 'home_workout'::text, 'mobility'::text, 'recovery'::text])
    ),
    CONSTRAINT workout_events_anchor_type_check CHECK (anchor_type = ANY (ARRAY['hard'::text, 'soft'::text, 'none'::text])),
    CONSTRAINT workout_events_block_type_check CHECK (
        block_type = ANY (ARRAY['strength'::text, 'run'::text, 'hyrox'::text, 'recovery'::text, 'mobility'::text, 'gym_class'::text, 'pt_session'::text, 'social_workout'::text, 'imported'::text, 'workout'::text])
    )
);

-- Create indexes
CREATE INDEX idx_workout_events_user_date ON public.workout_events USING btree (user_id, date);
CREATE INDEX idx_workout_events_is_anchor ON public.workout_events USING btree (is_anchor) WHERE is_anchor = true;
CREATE INDEX idx_workout_events_date_user ON public.workout_events USING btree (user_id, date);
CREATE INDEX idx_workout_events_block_type ON public.workout_events USING btree (block_type);
CREATE INDEX idx_workout_events_anchor_type ON public.workout_events USING btree (anchor_type);

-- Create triggers
CREATE TRIGGER trigger_sync_anchor_status
    BEFORE INSERT OR UPDATE ON workout_events
    FOR EACH ROW EXECUTE FUNCTION sync_anchor_status();

CREATE TRIGGER update_workout_events_updated_at
    BEFORE UPDATE ON workout_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
