-- Adds token and cost tracking to pipeline_runs table.
-- Part of AMA-567 Phase F: Cost Tracking

ALTER TABLE pipeline_runs
  ADD COLUMN IF NOT EXISTS input_tokens       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd numeric(10,6) NOT NULL DEFAULT 0;

-- Non-negative constraints (added separately since ADD COLUMN inline CHECK
-- requires the column to exist at parse time in some PG versions)
DO $$ BEGIN
    ALTER TABLE pipeline_runs ADD CONSTRAINT chk_input_tokens_non_negative CHECK (input_tokens >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE pipeline_runs ADD CONSTRAINT chk_output_tokens_non_negative CHECK (output_tokens >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE pipeline_runs ADD CONSTRAINT chk_cost_non_negative CHECK (estimated_cost_usd >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN pipeline_runs.input_tokens IS 'Total input tokens consumed by this pipeline run';
COMMENT ON COLUMN pipeline_runs.output_tokens IS 'Total output tokens consumed by this pipeline run';
COMMENT ON COLUMN pipeline_runs.estimated_cost_usd IS 'Estimated USD cost based on model pricing at time of run';
