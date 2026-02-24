-- Migration: Add atomic increment function for template usage count
-- Part of AMA-462: ProgramGenerator Service
--
-- This function provides atomic increment for template usage_count,
-- avoiding race conditions in concurrent program generation.

-- Function: increment_template_usage_count
-- Atomically increments usage_count for a template
CREATE OR REPLACE FUNCTION increment_template_usage_count(p_template_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rows_affected integer;
BEGIN
    UPDATE program_templates
    SET usage_count = usage_count + 1,
        updated_at = now()
    WHERE id = p_template_id;

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected > 0;
END;
$$;

-- Grant execute to authenticated users (needed for API calls)
GRANT EXECUTE ON FUNCTION increment_template_usage_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_template_usage_count(uuid) TO service_role;

COMMENT ON FUNCTION increment_template_usage_count IS 'Atomically increment template usage count to avoid race conditions';
