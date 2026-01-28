-- AMA-432: Semantic search RPC function for workout embeddings
--
-- Creates a match_workouts function that performs cosine similarity search
-- using pgvector against the workouts table embedding column.
-- Called via Supabase RPC from mapper-api.

CREATE OR REPLACE FUNCTION match_workouts(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  p_profile_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  profile_id text,
  title text,
  description text,
  workout_data jsonb,
  sources text[],
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.profile_id,
    w.title,
    w.description,
    w.workout_data,
    w.sources,
    w.created_at,
    (1 - (w.embedding <=> query_embedding))::float AS similarity
  FROM workouts w
  WHERE
    w.embedding IS NOT NULL
    AND (p_profile_id IS NULL OR w.profile_id = p_profile_id)
    AND (1 - (w.embedding <=> query_embedding)) > match_threshold
  ORDER BY w.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_workouts IS 'Semantic search over workout embeddings using cosine similarity (AMA-432)';
