-- ============================================================================
-- Table: pipeline_runs
-- Tracks workout pipeline executions (generate, import, bulk import).
-- Part of AMA-567: Workout Pipeline Infrastructure
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    pipeline    text NOT NULL
                    CHECK (pipeline IN ('generate', 'save_and_push', 'url_import', 'bulk_import')),
    status      text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    preview_id  text,
    input       jsonb,
    result      jsonb,
    error       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE pipeline_runs IS 'Tracks workout pipeline executions with status, cost, and stage progress';
COMMENT ON COLUMN pipeline_runs.user_id IS 'Clerk user ID (FK to profiles)';
COMMENT ON COLUMN pipeline_runs.pipeline IS 'Pipeline type: generate, save_and_push, url_import, bulk_import';
COMMENT ON COLUMN pipeline_runs.status IS 'Execution status: pending, running, completed, failed, cancelled';
COMMENT ON COLUMN pipeline_runs.preview_id IS 'Links generate run to its save_and_push run';
COMMENT ON COLUMN pipeline_runs.input IS 'Request parameters (jsonb)';
COMMENT ON COLUMN pipeline_runs.result IS 'Success payload (jsonb)';
COMMENT ON COLUMN pipeline_runs.error IS 'Failure message';

-- ============================================================================
-- Indexes
-- ============================================================================

-- Composite index for user-scoped listing queries (replaces single-column user_id index)
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_user_created
    ON pipeline_runs(user_id, created_at DESC);

-- Partial index for preview_id lookups (generate -> save_and_push linkage)
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_preview_id
    ON pipeline_runs(preview_id) WHERE preview_id IS NOT NULL;

-- ============================================================================
-- Trigger: auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_pipeline_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pipeline_runs_updated_at ON pipeline_runs;
CREATE TRIGGER trigger_pipeline_runs_updated_at
    BEFORE UPDATE ON pipeline_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_pipeline_runs_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

-- User policies: users can only access their own runs
DO $$ BEGIN
    CREATE POLICY pipeline_runs_select_own ON pipeline_runs
        FOR SELECT USING (auth.uid()::text = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY pipeline_runs_insert_own ON pipeline_runs
        FOR INSERT WITH CHECK (auth.uid()::text = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY pipeline_runs_update_own ON pipeline_runs
        FOR UPDATE USING (auth.uid()::text = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service role bypass (for API server with service key)
DO $$ BEGIN
    CREATE POLICY pipeline_runs_service_all ON pipeline_runs
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
