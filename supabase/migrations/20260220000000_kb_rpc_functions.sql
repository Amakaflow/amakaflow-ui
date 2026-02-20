-- 20260220000000_kb_rpc_functions.sql
-- AMA-663: knowledge_search_by_embedding and knowledge_increment_usage RPC functions
--
-- Requires: 20260218000000_create_knowledge_base_tables.sql
-- Called by: SupabaseKnowledgeRepository.search_by_embedding() and .increment_usage()

-- ============================================================================
-- Function: knowledge_search_by_embedding
-- Semantic search via cosine similarity on knowledge_cards.embedding.
-- SECURITY INVOKER: runs as the calling user, so user RLS policies apply.
-- ============================================================================
CREATE OR REPLACE FUNCTION knowledge_search_by_embedding(
    p_user_id        TEXT,
    p_embedding      vector(1536),
    p_limit          INT     DEFAULT 10,
    p_min_similarity FLOAT   DEFAULT 0.5
)
RETURNS TABLE (
    id                     UUID,
    user_id                TEXT,
    title                  TEXT,
    summary                TEXT,
    micro_summary          TEXT,
    key_takeaways          JSONB,
    source_type            TEXT,
    source_url             TEXT,
    processing_status      TEXT,
    embedding_content_hash TEXT,
    metadata               JSONB,
    created_at             TIMESTAMPTZ,
    updated_at             TIMESTAMPTZ,
    similarity             FLOAT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT
        kc.id,
        kc.user_id,
        kc.title,
        kc.summary,
        kc.micro_summary,
        kc.key_takeaways,
        kc.source_type,
        kc.source_url,
        kc.processing_status,
        kc.embedding_content_hash,
        kc.metadata,
        kc.created_at,
        kc.updated_at,
        1 - (kc.embedding <=> p_embedding) AS similarity
    FROM knowledge_cards kc
    WHERE
        kc.user_id = p_user_id
        AND kc.embedding IS NOT NULL
        AND kc.processing_status = 'complete'
        AND 1 - (kc.embedding <=> p_embedding) >= p_min_similarity
    ORDER BY kc.embedding <=> p_embedding
    LIMIT p_limit;
$$;

COMMENT ON FUNCTION knowledge_search_by_embedding IS
    'AMA-663: Semantic search for knowledge cards using cosine similarity via pgvector. '
    'Returns complete cards ordered by similarity descending.';

-- ============================================================================
-- Function: knowledge_increment_usage
-- Upsert monthly usage counters atomically.
-- Called by service role — users can SELECT but not INSERT/UPDATE the table.
-- ============================================================================
CREATE OR REPLACE FUNCTION knowledge_increment_usage(
    p_user_id            TEXT,
    p_period             TEXT,
    p_cards_ingested     INT     DEFAULT 0,
    p_queries_count      INT     DEFAULT 0,
    p_tokens_used        INT     DEFAULT 0,
    p_estimated_cost_usd NUMERIC DEFAULT 0
)
RETURNS VOID
LANGUAGE sql
VOLATILE
SECURITY DEFINER
AS $$
    INSERT INTO knowledge_usage_metrics (
        user_id, period, cards_ingested, queries_count, tokens_used, estimated_cost_usd
    ) VALUES (
        p_user_id, p_period,
        p_cards_ingested, p_queries_count, p_tokens_used, p_estimated_cost_usd
    )
    ON CONFLICT (user_id, period) DO UPDATE SET
        cards_ingested     = knowledge_usage_metrics.cards_ingested     + EXCLUDED.cards_ingested,
        queries_count      = knowledge_usage_metrics.queries_count      + EXCLUDED.queries_count,
        tokens_used        = knowledge_usage_metrics.tokens_used        + EXCLUDED.tokens_used,
        estimated_cost_usd = knowledge_usage_metrics.estimated_cost_usd + EXCLUDED.estimated_cost_usd;
$$;

COMMENT ON FUNCTION knowledge_increment_usage IS
    'AMA-663: Atomically upsert monthly KB usage counters. '
    'Safe to call multiple times — increments on conflict.';
