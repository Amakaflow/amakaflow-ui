-- 002_pipeline_runs_cost.sql
-- Adds token and cost tracking to pipeline_runs table.

ALTER TABLE pipeline_runs
  ADD COLUMN IF NOT EXISTS input_tokens  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd numeric(10,6) DEFAULT 0;

COMMENT ON COLUMN pipeline_runs.input_tokens IS 'Total input tokens consumed by this pipeline run';
COMMENT ON COLUMN pipeline_runs.output_tokens IS 'Total output tokens consumed by this pipeline run';
COMMENT ON COLUMN pipeline_runs.estimated_cost_usd IS 'Estimated USD cost based on model pricing at time of run';
