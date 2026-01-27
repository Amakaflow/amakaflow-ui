-- ============================================================================
-- AMA-430: Create chat tables for AI conversation functionality
-- ============================================================================

-- ============================================================================
-- Table: chat_sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Table: chat_messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT,
    tool_calls JSONB,
    tool_results JSONB,
    model TEXT,
    tokens_used INTEGER,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Table: ai_request_limits
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_request_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, request_date)
);

-- ============================================================================
-- Enable RLS
-- ============================================================================
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_request_limits ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies: chat_sessions (full CRUD scoped to user)
-- ============================================================================

DO $$ BEGIN
    CREATE POLICY "Users can view own chat sessions"
        ON chat_sessions FOR SELECT
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can create own chat sessions"
        ON chat_sessions FOR INSERT
        WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own chat sessions"
        ON chat_sessions FOR UPDATE
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
        WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete own chat sessions"
        ON chat_sessions FOR DELETE
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role full access on chat sessions"
        ON chat_sessions FOR ALL
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- RLS Policies: chat_messages
-- SELECT/UPDATE/DELETE use denormalized user_id; INSERT joins to chat_sessions
-- ============================================================================

DO $$ BEGIN
    CREATE POLICY "Users can view own chat messages"
        ON chat_messages FOR SELECT
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INSERT must check parent because trigger populates user_id AFTER RLS evaluation
DO $$ BEGIN
    CREATE POLICY "Users can create own chat messages"
        ON chat_messages FOR INSERT
        WITH CHECK (EXISTS (
            SELECT 1 FROM chat_sessions cs
            WHERE cs.id = chat_messages.session_id
            AND cs.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own chat messages"
        ON chat_messages FOR UPDATE
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete own chat messages"
        ON chat_messages FOR DELETE
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role full access on chat messages"
        ON chat_messages FOR ALL
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- RLS Policies: ai_request_limits (SELECT only for users; backend manages writes)
-- ============================================================================

DO $$ BEGIN
    CREATE POLICY "Users can view own request limits"
        ON ai_request_limits FOR SELECT
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role full access on ai request limits"
        ON ai_request_limits FOR ALL
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user
    ON chat_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
    ON chat_messages(session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user
    ON chat_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_request_limits_user_date
    ON ai_request_limits(user_id, request_date DESC);

-- ============================================================================
-- Trigger: auto-populate user_id on chat_messages from parent chat_sessions
-- ============================================================================
CREATE OR REPLACE FUNCTION set_chat_messages_user_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Unconditionally overwrite user_id from parent session to prevent spoofing
    SELECT user_id INTO NEW.user_id
    FROM chat_sessions
    WHERE id = NEW.session_id;

    IF NEW.user_id IS NULL THEN
        RAISE EXCEPTION 'Cannot set user_id: chat_sessions with id % not found', NEW.session_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_chat_messages_user_id ON chat_messages;
CREATE TRIGGER trigger_set_chat_messages_user_id
    BEFORE INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION set_chat_messages_user_id();

-- ============================================================================
-- Trigger: prevent user_id modification on chat_messages
-- ============================================================================
DROP TRIGGER IF EXISTS prevent_chat_messages_user_id_change ON chat_messages;
CREATE TRIGGER prevent_chat_messages_user_id_change
    BEFORE UPDATE ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION prevent_user_id_modification();

-- ============================================================================
-- Trigger: updated_at on chat_sessions
-- ============================================================================
CREATE OR REPLACE FUNCTION update_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER trigger_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_chat_sessions_updated_at();

-- ============================================================================
-- Trigger: updated_at on ai_request_limits
-- ============================================================================
CREATE OR REPLACE FUNCTION update_ai_request_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_request_limits_updated_at ON ai_request_limits;
CREATE TRIGGER trigger_ai_request_limits_updated_at
    BEFORE UPDATE ON ai_request_limits
    FOR EACH ROW EXECUTE FUNCTION update_ai_request_limits_updated_at();

-- ============================================================================
-- Trigger: prevent user_id modification on chat_sessions
-- ============================================================================
DROP TRIGGER IF EXISTS prevent_chat_sessions_user_id_change ON chat_sessions;
CREATE TRIGGER prevent_chat_sessions_user_id_change
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION prevent_user_id_modification();

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON COLUMN chat_messages.user_id IS 'Denormalized user_id for RLS performance - copied from chat_sessions';
COMMENT ON TABLE chat_sessions IS 'Stores AI chat conversation sessions per user';
COMMENT ON TABLE chat_messages IS 'Stores individual messages within chat sessions';
COMMENT ON TABLE ai_request_limits IS 'Tracks daily AI request counts per user for rate limiting';
