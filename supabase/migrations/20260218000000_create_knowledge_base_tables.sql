-- 20260218000000_create_knowledge_base_tables.sql
-- AMA-652: Fitness Knowledge Base — tables, indexes, RLS, triggers
--
-- Requires: 20260131000001_enable_pgvector.sql (vector extension already enabled)
-- Next:     AMA-663 — knowledge_search_by_embedding and knowledge_increment_usage RPC functions
--
-- Apply via: Supabase dashboard → SQL editor → paste + run

-- ============================================================================
-- Table: knowledge_cards
-- Atomic unit of knowledge. One row per ingested content item.
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_cards (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title                 TEXT,
    raw_content           TEXT,
    summary               TEXT,
    micro_summary         TEXT,                          -- ≤100 chars for watch display
    key_takeaways         JSONB DEFAULT '[]'::jsonb,     -- array of strings
    source_type           TEXT NOT NULL CHECK (source_type IN (
                              'url', 'youtube', 'pdf', 'manual', 'workout_log',
                              'chat_extract', 'voice_note', 'image', 'social_media',
                              'email', 'sensor_data', 'csv'
                          )),
    source_url            TEXT,
    processing_status     TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN (
                              'pending', 'extracting', 'summarizing', 'tagging',
                              'embedding', 'linking', 'complete', 'failed'
                          )),
    embedding             vector(1536),                  -- OpenAI text-embedding-3-small
    embedding_content_hash TEXT,                         -- SHA-256 of content used for embedding
    metadata              JSONB DEFAULT '{}'::jsonb,     -- extractor-specific extras
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE knowledge_cards IS 'AMA-652: Atomic knowledge units — articles, videos, PDFs ingested by the KB pipeline';
COMMENT ON COLUMN knowledge_cards.micro_summary IS 'Short summary ≤100 chars for Apple Watch display';
COMMENT ON COLUMN knowledge_cards.embedding_content_hash IS 'SHA-256 of content used to generate embedding — used for idempotent re-embedding';

-- knowledge_cards indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_user_id
    ON knowledge_cards(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_cards_source_url
    ON knowledge_cards(user_id, source_url)
    WHERE source_url IS NOT NULL;           -- deduplication lookup

CREATE INDEX IF NOT EXISTS idx_knowledge_cards_status
    ON knowledge_cards(user_id, processing_status);

-- HNSW for cosine similarity search (partial: only rows with embeddings)
-- HNSW chosen over IVFFlat: builds incrementally, no training data required,
-- 95%+ recall, works on empty table from day one.
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_embedding
    ON knowledge_cards USING hnsw (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL;

-- Auto-update updated_at on knowledge_cards
CREATE OR REPLACE FUNCTION update_knowledge_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_knowledge_cards_updated_at ON knowledge_cards;
CREATE TRIGGER trg_knowledge_cards_updated_at
    BEFORE UPDATE ON knowledge_cards
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_cards_updated_at();

-- ============================================================================
-- Table: knowledge_tags
-- User-scoped AI-discovered tag registry.
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_tags (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    tag_type   TEXT CHECK (tag_type IN (
                   'topic', 'muscle_group', 'equipment', 'methodology',
                   'sport', 'movement_pattern', 'goal'
               )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)   -- one tag name per user
);

COMMENT ON TABLE knowledge_tags IS 'AMA-652: AI-discovered tags for knowledge cards, scoped per user';

-- ============================================================================
-- Table: knowledge_card_tags
-- Many-to-many join with AI confidence score.
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_card_tags (
    card_id    UUID NOT NULL REFERENCES knowledge_cards(id) ON DELETE CASCADE,
    tag_id     UUID NOT NULL REFERENCES knowledge_tags(id) ON DELETE CASCADE,
    confidence FLOAT NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (card_id, tag_id)
);

COMMENT ON TABLE knowledge_card_tags IS 'AMA-652: Many-to-many join between cards and tags with AI confidence score';
COMMENT ON COLUMN knowledge_card_tags.confidence IS 'AI-assigned confidence 0.0–1.0; tags below 0.6 are typically filtered at query time';

-- ============================================================================
-- Table: knowledge_edges
-- Graph adjacency list — directed relationships between knowledge cards.
-- Phase 1 uses Postgres recursive CTEs for traversal.
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_edges (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    source_card_id    UUID NOT NULL REFERENCES knowledge_cards(id) ON DELETE CASCADE,
    target_card_id    UUID NOT NULL REFERENCES knowledge_cards(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
                          'related_to', 'builds_on', 'contradicts', 'same_topic', 'cites'
                      )),
    confidence        FLOAT NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (source_card_id <> target_card_id),
    UNIQUE (source_card_id, target_card_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source
    ON knowledge_edges(source_card_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_target
    ON knowledge_edges(target_card_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_user
    ON knowledge_edges(user_id);

COMMENT ON TABLE knowledge_edges IS 'AMA-652: Directed relationships between knowledge cards for graph traversal';
COMMENT ON COLUMN knowledge_edges.user_id IS 'Denormalized for RLS performance — avoids join to knowledge_cards on every query';

-- ============================================================================
-- Table: knowledge_usage_metrics
-- Monthly per-user activity and cost tracking.
-- Written exclusively by the API server (service role) via upsert RPC (AMA-663).
-- Users have SELECT-only access.
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_usage_metrics (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    period              TEXT NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),  -- 'YYYY-MM' e.g. '2026-02'
    cards_ingested      INT NOT NULL DEFAULT 0,
    queries_count       INT NOT NULL DEFAULT 0,
    tokens_used         INT NOT NULL DEFAULT 0,
    estimated_cost_usd  NUMERIC(10, 4) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, period)
);

COMMENT ON TABLE knowledge_usage_metrics IS 'AMA-652: Monthly per-user KB usage and cost tracking — written by API only';
COMMENT ON COLUMN knowledge_usage_metrics.period IS 'Month in YYYY-MM format, e.g. 2026-02';

-- Auto-update updated_at on knowledge_usage_metrics
CREATE OR REPLACE FUNCTION update_knowledge_usage_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_knowledge_usage_metrics_updated_at ON knowledge_usage_metrics;
CREATE TRIGGER trg_knowledge_usage_metrics_updated_at
    BEFORE UPDATE ON knowledge_usage_metrics
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_usage_metrics_updated_at();

-- ============================================================================
-- Enable Row Level Security on all knowledge base tables
-- ============================================================================
ALTER TABLE knowledge_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_card_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_usage_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies: knowledge_cards
-- ============================================================================
DO $$ BEGIN
    CREATE POLICY "Users can view own knowledge cards"
        ON knowledge_cards FOR SELECT
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can create own knowledge cards"
        ON knowledge_cards FOR INSERT
        WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own knowledge cards"
        ON knowledge_cards FOR UPDATE
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
        WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete own knowledge cards"
        ON knowledge_cards FOR DELETE
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Service role full access on knowledge cards"
        ON knowledge_cards FOR ALL
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- RLS Policies: knowledge_tags
-- ============================================================================
DO $$ BEGIN
    CREATE POLICY "Users can view own knowledge tags"
        ON knowledge_tags FOR SELECT
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can create own knowledge tags"
        ON knowledge_tags FOR INSERT
        WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own knowledge tags"
        ON knowledge_tags FOR UPDATE
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
        WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete own knowledge tags"
        ON knowledge_tags FOR DELETE
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Service role full access on knowledge tags"
        ON knowledge_tags FOR ALL
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- RLS Policies: knowledge_card_tags
-- Users access via card ownership — no direct user_id column on join table.
-- Service role handles all writes in pipeline.
-- ============================================================================
DO $$ BEGIN
    CREATE POLICY "Users can view own card tags"
        ON knowledge_card_tags FOR SELECT
        USING (EXISTS (
            SELECT 1 FROM knowledge_cards kc
            WHERE kc.id = knowledge_card_tags.card_id
            AND kc.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can create card tags for own cards"
        ON knowledge_card_tags FOR INSERT
        WITH CHECK (EXISTS (
            SELECT 1 FROM knowledge_cards kc
            WHERE kc.id = knowledge_card_tags.card_id
            AND kc.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete card tags for own cards"
        ON knowledge_card_tags FOR DELETE
        USING (EXISTS (
            SELECT 1 FROM knowledge_cards kc
            WHERE kc.id = knowledge_card_tags.card_id
            AND kc.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Service role full access on card tags"
        ON knowledge_card_tags FOR ALL
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- RLS Policies: knowledge_edges
-- user_id is denormalized on edges for direct RLS without join.
-- ============================================================================
DO $$ BEGIN
    CREATE POLICY "Users can view own knowledge edges"
        ON knowledge_edges FOR SELECT
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can create own knowledge edges"
        ON knowledge_edges FOR INSERT
        WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete own knowledge edges"
        ON knowledge_edges FOR DELETE
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Service role full access on knowledge edges"
        ON knowledge_edges FOR ALL
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- RLS Policies: knowledge_usage_metrics
-- SELECT only for users — backend manages writes via upsert RPC (AMA-663).
-- ============================================================================
DO $$ BEGIN
    CREATE POLICY "Users can view own knowledge usage metrics"
        ON knowledge_usage_metrics FOR SELECT
        USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Service role full access on knowledge usage metrics"
        ON knowledge_usage_metrics FOR ALL
        USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
