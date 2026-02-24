# Knowledge Base Database Migration Design
**Date:** 2026-02-18
**Linear:** AMA-652
**File:** `infrastructure/db/migrations/004_knowledge_base.sql`

## Goal

Create the Supabase/Postgres migration for the Fitness Knowledge Base — five tables that store
AI-processed knowledge cards with vector embeddings, tags, graph edges, and usage tracking.

## Tables

### `knowledge_cards`
Core unit. One row per ingested piece of content (article, YouTube video, PDF, manual entry).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| user_id | text NOT NULL | Clerk user ID, FK → profiles(id) CASCADE |
| title | text | Extracted or user-provided |
| raw_content | text | Full extracted text |
| summary | text | LLM-generated summary |
| micro_summary | text | ≤100 chars for watch display |
| key_takeaways | jsonb | Array of strings |
| source_type | text NOT NULL | Enum check: url, youtube, pdf, manual, workout_log, chat_extract, voice_note, image, social_media, email, sensor_data, csv |
| source_url | text | Required for URL-based types |
| processing_status | text NOT NULL DEFAULT 'pending' | Enum check: pending, extracting, summarizing, tagging, embedding, linking, complete, failed |
| embedding | vector(1536) | OpenAI text-embedding-3-small |
| embedding_content_hash | text | For idempotent re-embedding |
| metadata | jsonb DEFAULT '{}' | Extractor-specific metadata |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | Auto-updated via trigger |

**Indexes:**
- `idx_knowledge_cards_user_id` on (user_id, created_at DESC)
- `idx_knowledge_cards_source_url` on (user_id, source_url) WHERE source_url IS NOT NULL — for deduplication
- `idx_knowledge_cards_status` on (user_id, processing_status)
- `idx_knowledge_cards_embedding` HNSW on (embedding vector_cosine_ops) WHERE embedding IS NOT NULL

**Why HNSW over IVFFlat:** HNSW builds incrementally (no training data required), works on an
empty table from day one, delivers 95%+ recall out of the box, and never requires reindexing as
rows grow. IVFFlat requires existing data to build clusters and degrades without periodic
reindexing. The existing codebase uses HNSW for workout embeddings for the same reasons.

### `knowledge_tags`
User-scoped tag registry. Tags are AI-discovered and reused across cards.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text NOT NULL | FK → profiles(id) CASCADE |
| name | text NOT NULL | e.g. "hyrox", "strength", "zone2" |
| tag_type | text | topic, muscle_group, equipment, methodology, sport, movement_pattern, goal |
| created_at | timestamptz DEFAULT now() | |

**Constraints:** UNIQUE (user_id, name) — one tag name per user.

### `knowledge_card_tags`
Many-to-many join between cards and tags, with AI confidence score.

| Column | Type | Notes |
|---|---|---|
| card_id | uuid NOT NULL | FK → knowledge_cards(id) CASCADE |
| tag_id | uuid NOT NULL | FK → knowledge_tags(id) CASCADE |
| confidence | float DEFAULT 1.0 | 0.0–1.0, AI-assigned |
| created_at | timestamptz DEFAULT now() | |

**Constraints:** PRIMARY KEY (card_id, tag_id).

### `knowledge_edges`
Graph adjacency list — directed relationships between cards.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text NOT NULL | Denormalized for RLS performance |
| source_card_id | uuid NOT NULL | FK → knowledge_cards(id) CASCADE |
| target_card_id | uuid NOT NULL | FK → knowledge_cards(id) CASCADE |
| relationship_type | text NOT NULL | related_to, builds_on, contradicts, same_topic, cites |
| confidence | float DEFAULT 1.0 | LLM-assigned |
| created_at | timestamptz DEFAULT now() | |

**Constraints:** UNIQUE (source_card_id, target_card_id, relationship_type).

### `knowledge_usage_metrics`
Monthly per-user cost and activity tracking. Upserted by the API — users never write directly.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text NOT NULL | FK → profiles(id) CASCADE |
| period | text NOT NULL | 'YYYY-MM' format |
| cards_ingested | int DEFAULT 0 | |
| queries_count | int DEFAULT 0 | |
| tokens_used | int DEFAULT 0 | |
| estimated_cost_usd | numeric(10,4) DEFAULT 0 | |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

**Constraints:** UNIQUE (user_id, period).

## RLS Policies

All tables enable RLS. Pattern matches `create_chat_tables.sql` exactly:

- Wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` for idempotency
- User isolation: `current_setting('request.jwt.claims', true)::json->>'sub'`
- Service role bypass: `current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'`

| Table | User policies | Service role |
|---|---|---|
| knowledge_cards | SELECT, INSERT, UPDATE, DELETE | ALL |
| knowledge_tags | SELECT, INSERT, UPDATE, DELETE | ALL |
| knowledge_card_tags | SELECT, INSERT, DELETE | ALL |
| knowledge_edges | SELECT, INSERT, DELETE | ALL |
| knowledge_usage_metrics | SELECT only | ALL |

`knowledge_usage_metrics` is SELECT-only for users — the API backend (service role) manages all writes via the upsert RPC function defined in AMA-663.

## Triggers

`updated_at` auto-trigger on `knowledge_cards` only (matching ticket spec):

```sql
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

## What This Migration Does NOT Include

- `CREATE EXTENSION IF NOT EXISTS vector` — already in `20260131000001_enable_pgvector.sql`
- Search RPC functions (`knowledge_search_by_embedding`, `knowledge_increment_usage`) — covered by AMA-663 (`005_knowledge_search_function.sql`)

## Acceptance Criteria

- [ ] Migration applies cleanly via Supabase SQL editor on an empty schema
- [ ] All tables have appropriate indexes (including partial HNSW on embedding)
- [ ] RLS policies enforce user isolation — users cannot read other users' cards
- [ ] Service role can bypass RLS for API server writes
- [ ] `updated_at` auto-updates on knowledge_cards modification
- [ ] FK cascade deletes clean up tags and edges when a card is deleted
- [ ] Deduplication lookup by (user_id, source_url) is indexed
