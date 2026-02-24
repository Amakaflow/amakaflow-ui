-- 003_pipeline_runs_stages.sql
-- Adds stage tracking for resume-from-checkpoint semantics.

ALTER TABLE pipeline_runs
  ADD COLUMN IF NOT EXISTS completed_stages jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_stage    text,
  ADD COLUMN IF NOT EXISTS stage_data       jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN pipeline_runs.completed_stages IS 'Array of completed stage names for resume support';
COMMENT ON COLUMN pipeline_runs.current_stage IS 'Currently executing stage name';
COMMENT ON COLUMN pipeline_runs.stage_data IS 'Intermediate results per stage for resume (keyed by stage name)';
