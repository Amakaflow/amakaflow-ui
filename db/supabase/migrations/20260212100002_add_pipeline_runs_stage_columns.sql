-- Adds stage tracking for resume-from-checkpoint semantics.
-- Part of AMA-567 Phase F: Pipeline Resume

ALTER TABLE pipeline_runs
  ADD COLUMN IF NOT EXISTS completed_stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_stage    text,
  ADD COLUMN IF NOT EXISTS stage_data       jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN pipeline_runs.completed_stages IS 'Array of completed stage names for resume support';
COMMENT ON COLUMN pipeline_runs.current_stage IS 'Currently executing stage name';
COMMENT ON COLUMN pipeline_runs.stage_data IS 'Intermediate results per stage for resume (keyed by stage name)';
