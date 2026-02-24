-- Migration: Add updated_at column to program_templates
-- The increment_template_usage_count function references updated_at but the column
-- was not included when program_templates was created.

ALTER TABLE program_templates
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill existing rows with created_at as a reasonable default
UPDATE program_templates SET updated_at = created_at;

-- Trigger to keep updated_at current on every update
CREATE OR REPLACE FUNCTION update_program_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_program_templates_updated_at ON program_templates;
CREATE TRIGGER trigger_program_templates_updated_at
    BEFORE UPDATE ON program_templates
    FOR EACH ROW EXECUTE FUNCTION update_program_templates_updated_at();

COMMENT ON COLUMN program_templates.updated_at IS 'Timestamp of last modification';
