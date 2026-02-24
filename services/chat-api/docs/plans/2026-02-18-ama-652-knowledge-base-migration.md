# Knowledge Base Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `infrastructure/db/migrations/004_knowledge_base.sql` — the Postgres migration for the Fitness Knowledge Base (5 tables, RLS, HNSW vector index, triggers).

**Architecture:** Single SQL migration file applied via Supabase SQL editor. Follows the exact patterns established in `001_pipeline_runs.sql` and `create_chat_tables.sql`. pgvector extension already enabled — do not re-enable it. RPC search functions are in a separate migration (AMA-663).

**Tech Stack:** PostgreSQL, pgvector (vector(1536) + HNSW), Supabase RLS (JWT claims), plpgsql triggers.

**Design doc:** `docs/plans/2026-02-18-knowledge-base-migration-design.md`

---

## Task 1: Set Up Worktree

**Step 1: Create worktree**

```bash
git worktree add ~/.config/superpowers/worktrees/chat-api/ama-652-kb-migration -b feat/AMA-652-kb-migration
cd ~/.config/superpowers/worktrees/chat-api/ama-652-kb-migration
```

**Step 2: Verify you're on the right branch**

```bash
git branch --show-current
```
Expected: `feat/AMA-652-kb-migration`

---

## Task 2: Create Migration File Skeleton

**Files:**
- Create: `infrastructure/db/migrations/004_knowledge_base.sql`

**Step 1: Create the file with header**

```sql
-- 004_knowledge_base.sql
-- AMA-652: Fitness Knowledge Base — tables, indexes, RLS, triggers
--
-- Requires: 20260131000001_enable_pgvector.sql (vector extension already enabled)
-- Next:     005_knowledge_search_function.sql (AMA-663 — search + usage RPC functions)
--
-- Apply via: Supabase dashboard → SQL editor → paste + run
```

**Step 2: Verify file exists**

```bash
ls -la infrastructure/db/migrations/004_knowledge_base.sql
```
Expected: file listed

**Step 3: Commit skeleton**

```bash
git add infrastructure/db/migrations/004_knowledge_base.sql
git commit -m "feat(AMA-652): add migration skeleton for knowledge base"
```

---

## Task 3: `knowledge_cards` Table

This is the core table. Every other table references it.

**Files:**
- Modify: `infrastructure/db/migrations/004_knowledge_base.sql`

**Step 1: Append the knowledge_cards table definition**

```sql
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
    embedding             vector(1536),
    embedding_content_hash TEXT,                         -- SHA-256 of content used for embedding
    metadata              JSONB DEFAULT '{}'::jsonb,     -- extractor-specific extras
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE knowledge_cards IS 'AMA-652: Atomic knowledge units — articles, videos, PDFs ingested by the KB pipeline';
COMMENT ON COLUMN knowledge_cards.micro_summary IS 'Short summary ≤100 chars for Apple Watch display';
COMMENT ON COLUMN knowledge_cards.embedding_content_hash IS 'SHA-256 of content used to generate embedding — used for idempotent re-embedding';
```

**Step 2: Append indexes for knowledge_cards**

```sql
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
```

**Step 3: Append updated_at trigger for knowledge_cards**

```sql
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
```

**Step 4: Review the section — verify:**
- source_type CHECK values match `SourceType` enum in AMA-653 domain models
- processing_status CHECK values match `ProcessingStatus` enum in AMA-653
- vector dimension is 1536 (matches OpenAI text-embedding-3-small)
- HNSW index is partial (WHERE embedding IS NOT NULL)

**Step 5: Commit**

```bash
git add infrastructure/db/migrations/004_knowledge_base.sql
git commit -m "feat(AMA-652): add knowledge_cards table with HNSW embedding index"
```

---

## Task 4: `knowledge_tags`, `knowledge_card_tags`, `knowledge_edges` Tables

**Files:**
- Modify: `infrastructure/db/migrations/004_knowledge_base.sql`

**Step 1: Append knowledge_tags**

```sql
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
```

**Step 2: Append knowledge_card_tags join table**

```sql
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
```

**Step 3: Append knowledge_edges**

```sql
-- ============================================================================
-- Table: knowledge_edges
-- Graph adjacency list — directed relationships between knowledge cards.
-- Phase 1 uses Postgres recursive CTEs for traversal.
-- Phase 6 (future): swap in Neo4j adapter via KnowledgeGraphPort.
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
```

**Step 4: Review — verify:**
- `knowledge_edges.user_id` is denormalized (same pattern as `chat_messages.user_id`)
- relationship_type values match `RelationshipType` enum in AMA-653
- CASCADE on card delete will clean up tags and edges automatically

**Step 5: Commit**

```bash
git add infrastructure/db/migrations/004_knowledge_base.sql
git commit -m "feat(AMA-652): add knowledge_tags, card_tags, and edges tables"
```

---

## Task 5: `knowledge_usage_metrics` Table

**Files:**
- Modify: `infrastructure/db/migrations/004_knowledge_base.sql`

**Step 1: Append knowledge_usage_metrics**

```sql
-- ============================================================================
-- Table: knowledge_usage_metrics
-- Monthly per-user activity and cost tracking.
-- Written exclusively by the API server (service role) via upsert RPC (AMA-663).
-- Users have SELECT-only access.
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_usage_metrics (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    period              TEXT NOT NULL,           -- 'YYYY-MM' e.g. '2026-02'
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
```

**Step 2: Commit**

```bash
git add infrastructure/db/migrations/004_knowledge_base.sql
git commit -m "feat(AMA-652): add knowledge_usage_metrics table"
```

---

## Task 6: Enable RLS on All Tables

**Files:**
- Modify: `infrastructure/db/migrations/004_knowledge_base.sql`

**Step 1: Append RLS enable block**

```sql
-- ============================================================================
-- Enable Row Level Security on all knowledge base tables
-- ============================================================================
ALTER TABLE knowledge_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_card_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_usage_metrics ENABLE ROW LEVEL SECURITY;
```

**Step 2: Commit**

```bash
git add infrastructure/db/migrations/004_knowledge_base.sql
git commit -m "feat(AMA-652): enable RLS on all knowledge base tables"
```

---

## Task 7: RLS Policies — `knowledge_cards`

**Context:** Pattern is identical to `create_chat_tables.sql`. Each policy is wrapped in
`DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` for idempotency.
User identity comes from `current_setting('request.jwt.claims', true)::json->>'sub'`.
Service role bypass uses `::json->>'role' = 'service_role'`.

**Files:**
- Modify: `infrastructure/db/migrations/004_knowledge_base.sql`

**Step 1: Append knowledge_cards RLS policies**

```sql
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
```

**Step 2: Commit**

```bash
git add infrastructure/db/migrations/004_knowledge_base.sql
git commit -m "feat(AMA-652): add RLS policies for knowledge_cards"
```

---

## Task 8: RLS Policies — `knowledge_tags`, `knowledge_card_tags`, `knowledge_edges`

**Files:**
- Modify: `infrastructure/db/migrations/004_knowledge_base.sql`

**Step 1: Append knowledge_tags RLS policies**

```sql
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
```

**Step 2: Append knowledge_card_tags RLS policies**

```sql
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
```

**Step 3: Append knowledge_edges RLS policies**

```sql
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
```

**Step 4: Commit**

```bash
git add infrastructure/db/migrations/004_knowledge_base.sql
git commit -m "feat(AMA-652): add RLS policies for tags, card_tags, and edges"
```

---

## Task 9: RLS Policies — `knowledge_usage_metrics`

Users get SELECT only. All writes go through the service role via RPC (AMA-663).

**Files:**
- Modify: `infrastructure/db/migrations/004_knowledge_base.sql`

**Step 1: Append knowledge_usage_metrics RLS policies**

```sql
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
```

**Step 2: Commit**

```bash
git add infrastructure/db/migrations/004_knowledge_base.sql
git commit -m "feat(AMA-652): add RLS policies for knowledge_usage_metrics"
```

---

## Task 10: Final Review and PR

**Step 1: Read the full migration file and verify every section**

```bash
cat infrastructure/db/migrations/004_knowledge_base.sql
```

Check against this list:
- [ ] File header with AMA-652 reference and apply instructions
- [ ] `knowledge_cards` — all columns, source_type CHECK, processing_status CHECK, vector(1536)
- [ ] 4 indexes on knowledge_cards (user_id, source_url partial, status, HNSW embedding partial)
- [ ] `updated_at` trigger on knowledge_cards (DROP TRIGGER IF EXISTS before CREATE)
- [ ] `knowledge_tags` — UNIQUE (user_id, name), tag_type CHECK
- [ ] `knowledge_card_tags` — composite PK (card_id, tag_id), confidence CHECK 0-1
- [ ] `knowledge_edges` — UNIQUE (source, target, relationship_type), 3 indexes, denormalized user_id
- [ ] `knowledge_usage_metrics` — UNIQUE (user_id, period), numeric(10,4) for cost
- [ ] ALTER TABLE ... ENABLE ROW LEVEL SECURITY on all 5 tables
- [ ] knowledge_cards: SELECT, INSERT, UPDATE, DELETE (user) + ALL (service role) — 5 policies
- [ ] knowledge_tags: SELECT, INSERT, UPDATE, DELETE (user) + ALL (service role) — 5 policies
- [ ] knowledge_card_tags: SELECT, INSERT, DELETE via subquery (user) + ALL (service role) — 4 policies
- [ ] knowledge_edges: SELECT, INSERT, DELETE (user) + ALL (service role) — 4 policies
- [ ] knowledge_usage_metrics: SELECT (user) + ALL (service role) — 2 policies
- [ ] Total: 20 RLS policies, all in DO $$ BEGIN...EXCEPTION WHEN duplicate_object...END $$ wrappers

**Step 2: Count policies to confirm**

```bash
grep -c "CREATE POLICY" infrastructure/db/migrations/004_knowledge_base.sql
```
Expected: `20`

**Step 3: Count tables**

```bash
grep -c "^CREATE TABLE" infrastructure/db/migrations/004_knowledge_base.sql
```
Expected: `5`

**Step 4: Verify HNSW index present and not IVFFlat**

```bash
grep -i "ivfflat\|hnsw" infrastructure/db/migrations/004_knowledge_base.sql
```
Expected: one line with `hnsw`, zero lines with `ivfflat`

**Step 5: Verify no `CREATE EXTENSION` (already exists)**

```bash
grep "CREATE EXTENSION" infrastructure/db/migrations/004_knowledge_base.sql
```
Expected: no output

**Step 6: Push branch and open PR**

```bash
git push -u origin feat/AMA-652-kb-migration
gh pr create \
  --title "feat(AMA-652): knowledge base database migration" \
  --body "$(cat <<'EOF'
## Summary
- Adds 5 new tables for Fitness Knowledge Base: `knowledge_cards`, `knowledge_tags`, `knowledge_card_tags`, `knowledge_edges`, `knowledge_usage_metrics`
- HNSW vector index on `knowledge_cards.embedding` (1536-dim, cosine similarity)
- Full RLS isolation — users see only their own data, service role bypasses for API writes
- `updated_at` auto-trigger on `knowledge_cards`
- FK cascades clean up tags and edges when a card is deleted
- Does NOT include search RPC functions (AMA-663) or domain models (AMA-653)

## Test plan
- [ ] Apply migration via Supabase SQL editor — verify no errors
- [ ] Confirm all 5 tables appear in Supabase table editor
- [ ] Confirm HNSW index visible on `knowledge_cards`
- [ ] Verify RLS by querying as anon — expect 0 rows
- [ ] Verify service role can insert a test card

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Acceptance Criteria Checklist

- [ ] Migration applies cleanly via Supabase SQL editor with no errors
- [ ] All 5 tables present with correct columns and constraints
- [ ] HNSW index on `knowledge_cards.embedding` (partial, cosine ops)
- [ ] `source_url` deduplication index exists (partial, where NOT NULL)
- [ ] RLS enforced — authenticated user cannot read another user's cards
- [ ] Service role can bypass RLS for pipeline writes
- [ ] `updated_at` auto-updates when a knowledge_card row is modified
- [ ] Deleting a card cascades to remove its tags and edges
- [ ] No `CREATE EXTENSION vector` (already exists from prior migration)
