-- Pipeline runs table for tracking workout pipeline executions.
-- Apply via Supabase dashboard SQL editor.

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     text NOT NULL,
    pipeline    text NOT NULL,          -- "generate" | "save_and_push"
    status      text NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, cancelled
    preview_id  text,                   -- links generate → save_and_push
    input       jsonb,                  -- request parameters
    result      jsonb,                  -- success payload
    error       text,                   -- failure message
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for user-scoped queries and polling endpoint
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_user_id ON pipeline_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_preview_id ON pipeline_runs(preview_id) WHERE preview_id IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_pipeline_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pipeline_runs_updated_at
    BEFORE UPDATE ON pipeline_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_pipeline_runs_updated_at();

-- Row Level Security: users can only see their own runs
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY pipeline_runs_select_own ON pipeline_runs
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY pipeline_runs_insert_own ON pipeline_runs
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY pipeline_runs_update_own ON pipeline_runs
    FOR UPDATE USING (auth.uid()::text = user_id);

-- Service role bypass (for API server with service key)
CREATE POLICY pipeline_runs_service_all ON pipeline_runs
    FOR ALL USING (auth.role() = 'service_role');
