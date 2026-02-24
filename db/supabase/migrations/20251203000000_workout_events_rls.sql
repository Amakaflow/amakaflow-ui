-- Enable RLS on workout_events
ALTER TABLE public.workout_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "select_own_events" ON public.workout_events
FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "insert_own_events" ON public.workout_events
FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "update_own_events" ON public.workout_events
FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "delete_own_events" ON public.workout_events
FOR DELETE USING (auth.uid()::text = user_id);
