-- ============================================================================
-- AMA-502: Add support for persisting tool results as separate messages
-- ============================================================================
-- This migration:
-- 1. Adds tool_use_id column to link tool results back to tool_use blocks
-- 2. Updates role constraint to allow 'tool_result' role
-- ============================================================================

-- Add tool_use_id column for linking tool results to their tool_use blocks
ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS tool_use_id TEXT;

-- Update role constraint to include 'tool_result'
-- PostgreSQL auto-generates constraint names for inline CHECK constraints,
-- so we need to dynamically find and drop the existing role constraint.
-- We also need to handle the case where a previous migration run already
-- created the named constraint.
DO $$
DECLARE
    constraint_rec RECORD;
BEGIN
    -- Drop ALL CHECK constraints on chat_messages that reference role values
    -- This handles both auto-generated names and the explicit name from previous runs
    FOR constraint_rec IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE t.relname = 'chat_messages'
          AND n.nspname = 'public'
          AND c.contype = 'c'  -- CHECK constraint
          AND (
              pg_get_constraintdef(c.oid) LIKE '%role%'
              OR c.conname = 'chat_messages_role_check'
          )
    LOOP
        EXECUTE 'ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_rec.conname);
    END LOOP;
END $$;

-- Add the updated constraint with 'tool_result' role
ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_role_check
    CHECK (role IN ('user', 'assistant', 'system', 'tool', 'tool_result'));

-- Add index for efficient lookup of tool results by tool_use_id
CREATE INDEX IF NOT EXISTS idx_chat_messages_tool_use_id
    ON chat_messages(tool_use_id)
    WHERE tool_use_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN chat_messages.tool_use_id IS 'Links tool_result messages back to their corresponding tool_use block ID';
