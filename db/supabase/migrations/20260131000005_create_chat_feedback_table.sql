-- Chat Feedback Table
-- Captures beta user feedback on the AI chat assistant
-- Part of AMA-437: Feature Flags & Beta Rollout Configuration

-- Create chat_feedback table
-- Note: session_id and message_id are TEXT to match frontend string IDs (e.g., "msg_abc123")
CREATE TABLE IF NOT EXISTS chat_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,  -- Clerk user ID
    session_id TEXT,  -- Chat session ID (string format from frontend)
    message_id TEXT,  -- Message ID (string format like "msg_abc123")
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    feedback_text TEXT,
    feature TEXT,  -- Which feature the feedback relates to (e.g., 'response_quality', 'tool_execution', 'voice_input')
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_feedback_user_id ON chat_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_sentiment ON chat_feedback(sentiment);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_feature ON chat_feedback(feature);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_created_at ON chat_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_session_id ON chat_feedback(session_id) WHERE session_id IS NOT NULL;

-- Enable RLS
ALTER TABLE chat_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can insert their own feedback (must match their JWT user ID)
CREATE POLICY "Users can insert own feedback"
    ON chat_feedback
    FOR INSERT
    WITH CHECK (
        user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    );

-- Users can read their own feedback
CREATE POLICY "Users can read own feedback"
    ON chat_feedback
    FOR SELECT
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Service role has full access for analytics and reporting
CREATE POLICY "Service role full access to chat feedback"
    ON chat_feedback
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE chat_feedback IS 'Beta user feedback on the AI chat assistant for quality improvement.';
COMMENT ON COLUMN chat_feedback.sentiment IS 'User sentiment: positive (thumbs up), negative (thumbs down), or neutral';
COMMENT ON COLUMN chat_feedback.feature IS 'Which feature the feedback relates to (response_quality, tool_execution, voice_input, etc.)';
COMMENT ON COLUMN chat_feedback.metadata IS 'Additional context like browser info, response latency, etc.';
