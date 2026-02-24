-- Fix RLS policy for workout_completions table (AMA-217)
--
-- Bug: The "Service role full access" policy only had USING clause.
-- PostgreSQL RLS requires WITH CHECK for INSERT operations.
-- Without WITH CHECK, INSERT operations fail even for service role.

-- Drop the buggy policy
DROP POLICY IF EXISTS "Service role full access" ON workout_completions;

-- Recreate with both USING (for SELECT/UPDATE/DELETE) and WITH CHECK (for INSERT/UPDATE)
CREATE POLICY "Service role full access"
    ON workout_completions
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Add comment explaining the fix
COMMENT ON POLICY "Service role full access" ON workout_completions IS
    'Allows backend API (using service role key) full access. Both USING and WITH CHECK required for INSERT support.';
