-- ============================================================================
-- AMA-430: Add embedding columns to workouts and follow_along_workouts
-- for semantic search via pgvector
--
-- Embedding dimension: 1536 (OpenAI text-embedding-ada-002 / text-embedding-3-small)
-- If switching to text-embedding-3-large (3072 dims), column and indexes must be rebuilt.
-- ============================================================================

-- Add embedding column to workouts
ALTER TABLE workouts
    ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add embedding column to follow_along_workouts
ALTER TABLE follow_along_workouts
    ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- HNSW indexes for cosine similarity search (partial: only indexed rows)
-- HNSW chosen over IVFFlat: no training data required, better recall at low-to-medium row counts
CREATE INDEX IF NOT EXISTS idx_workouts_embedding
    ON workouts USING hnsw (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_follow_along_workouts_embedding
    ON follow_along_workouts USING hnsw (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL;
