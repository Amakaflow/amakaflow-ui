-- ============================================================================
-- Bulk Import Tables
-- AMA-100: Bulk Import Controller & State Management
--
-- Creates tables for tracking bulk import jobs and detected items for the
-- 5-step workflow: Detect -> Map -> Match -> Preview -> Import
-- ============================================================================

-- ============================================================================
-- Table: bulk_import_jobs
-- Tracks the overall import job and its progress
-- ============================================================================
CREATE TABLE IF NOT EXISTS bulk_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id TEXT NOT NULL,

    -- Job status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'complete', 'failed', 'cancelled')),

    -- Input configuration
    input_type TEXT NOT NULL
        CHECK (input_type IN ('file', 'urls', 'images')),

    -- Progress tracking
    total_items INT NOT NULL DEFAULT 0,
    processed_items INT NOT NULL DEFAULT 0,
    current_item TEXT,

    -- Results
    results JSONB DEFAULT '[]'::jsonb,
    error TEXT,

    -- State snapshot for resume capability
    state_snapshot JSONB,

    -- Column mappings (for file imports)
    column_mappings JSONB,

    -- Exercise matches
    exercise_matches JSONB,

    -- Detection metadata
    detection_metadata JSONB,

    -- Device target
    target_device TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_bulk_import_jobs_profile
    ON bulk_import_jobs(profile_id);
CREATE INDEX IF NOT EXISTS idx_bulk_import_jobs_status
    ON bulk_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bulk_import_jobs_created
    ON bulk_import_jobs(created_at DESC);

-- ============================================================================
-- Table: bulk_import_detected_items
-- Stores detected/parsed items during the import workflow
-- ============================================================================
CREATE TABLE IF NOT EXISTS bulk_import_detected_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES bulk_import_jobs(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL,

    -- Source information
    source_index INT NOT NULL,
    source_type TEXT NOT NULL
        CHECK (source_type IN ('file', 'urls', 'images')),
    source_ref TEXT NOT NULL, -- filename, URL, or image identifier

    -- Raw and parsed data
    raw_data JSONB NOT NULL,
    parsed_workout JSONB, -- Parsed WorkoutStructure

    -- Detection quality
    confidence FLOAT DEFAULT 0
        CHECK (confidence >= 0 AND confidence <= 100),

    -- Errors and warnings
    errors JSONB DEFAULT '[]'::jsonb,
    warnings JSONB DEFAULT '[]'::jsonb,

    -- Selection state
    selected BOOLEAN DEFAULT true,

    -- Validation results
    validation_issues JSONB DEFAULT '[]'::jsonb,

    -- Duplicate detection
    is_duplicate BOOLEAN DEFAULT false,
    duplicate_of UUID, -- Reference to existing workout

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bulk_detected_job
    ON bulk_import_detected_items(job_id);
CREATE INDEX IF NOT EXISTS idx_bulk_detected_profile
    ON bulk_import_detected_items(profile_id);
CREATE INDEX IF NOT EXISTS idx_bulk_detected_selected
    ON bulk_import_detected_items(job_id, selected) WHERE selected = true;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE bulk_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_import_detected_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own import jobs
CREATE POLICY bulk_import_jobs_select_own ON bulk_import_jobs
    FOR SELECT
    USING (profile_id = current_setting('request.jwt.claims', true)::json->>'sub'
           OR profile_id = current_setting('app.current_user_id', true));

CREATE POLICY bulk_import_jobs_insert_own ON bulk_import_jobs
    FOR INSERT
    WITH CHECK (profile_id = current_setting('request.jwt.claims', true)::json->>'sub'
                OR profile_id = current_setting('app.current_user_id', true));

CREATE POLICY bulk_import_jobs_update_own ON bulk_import_jobs
    FOR UPDATE
    USING (profile_id = current_setting('request.jwt.claims', true)::json->>'sub'
           OR profile_id = current_setting('app.current_user_id', true));

CREATE POLICY bulk_import_jobs_delete_own ON bulk_import_jobs
    FOR DELETE
    USING (profile_id = current_setting('request.jwt.claims', true)::json->>'sub'
           OR profile_id = current_setting('app.current_user_id', true));

-- Policy: Users can only see their own detected items
CREATE POLICY bulk_detected_items_select_own ON bulk_import_detected_items
    FOR SELECT
    USING (profile_id = current_setting('request.jwt.claims', true)::json->>'sub'
           OR profile_id = current_setting('app.current_user_id', true));

CREATE POLICY bulk_detected_items_insert_own ON bulk_import_detected_items
    FOR INSERT
    WITH CHECK (profile_id = current_setting('request.jwt.claims', true)::json->>'sub'
                OR profile_id = current_setting('app.current_user_id', true));

CREATE POLICY bulk_detected_items_update_own ON bulk_import_detected_items
    FOR UPDATE
    USING (profile_id = current_setting('request.jwt.claims', true)::json->>'sub'
           OR profile_id = current_setting('app.current_user_id', true));

CREATE POLICY bulk_detected_items_delete_own ON bulk_import_detected_items
    FOR DELETE
    USING (profile_id = current_setting('request.jwt.claims', true)::json->>'sub'
           OR profile_id = current_setting('app.current_user_id', true));

-- ============================================================================
-- Service role bypass policies
-- Allow service role to bypass RLS for backend operations
-- ============================================================================

CREATE POLICY bulk_import_jobs_service_all ON bulk_import_jobs
    FOR ALL
    USING (current_setting('role', true) = 'service_role')
    WITH CHECK (current_setting('role', true) = 'service_role');

CREATE POLICY bulk_detected_items_service_all ON bulk_import_detected_items
    FOR ALL
    USING (current_setting('role', true) = 'service_role')
    WITH CHECK (current_setting('role', true) = 'service_role');

-- ============================================================================
-- Updated at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_bulk_import_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bulk_import_jobs_updated_at
    BEFORE UPDATE ON bulk_import_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_bulk_import_updated_at();

CREATE TRIGGER bulk_import_detected_items_updated_at
    BEFORE UPDATE ON bulk_import_detected_items
    FOR EACH ROW
    EXECUTE FUNCTION update_bulk_import_updated_at();

-- ============================================================================
-- Cleanup function for old jobs (optional, for maintenance)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_bulk_import_jobs(days_old INT DEFAULT 30)
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    WITH deleted AS (
        DELETE FROM bulk_import_jobs
        WHERE status IN ('complete', 'failed', 'cancelled')
        AND created_at < NOW() - (days_old || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE bulk_import_jobs IS
    'Tracks bulk import jobs for the 5-step workflow (Detect -> Map -> Match -> Preview -> Import)';

COMMENT ON TABLE bulk_import_detected_items IS
    'Stores detected/parsed workout items during the bulk import workflow';

COMMENT ON COLUMN bulk_import_jobs.state_snapshot IS
    'JSON snapshot of full BulkImportState for resume capability';

COMMENT ON COLUMN bulk_import_jobs.column_mappings IS
    'Column mapping configuration for file imports';

COMMENT ON COLUMN bulk_import_detected_items.parsed_workout IS
    'Parsed WorkoutStructure ready for import';
