-- ============================================
-- Self-Evolving Agent Phase 3: 교정 피드백 루프
-- agent_corrections + search_similar_corrections RPC
-- ============================================

CREATE TABLE agent_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE NOT NULL,
  message_index SMALLINT NOT NULL,
  original_response TEXT NOT NULL,
  correction_text TEXT NOT NULL,
  correction_type TEXT NOT NULL DEFAULT 'strategic'
    CHECK (correction_type IN ('factual', 'strategic', 'nuance', 'missing')),
  context_summary TEXT,
  created_by UUID NOT NULL,
  embedding vector(768),
  embedding_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_corrections_tenant ON agent_corrections(tenant_id, created_at DESC);
CREATE INDEX idx_corrections_session ON agent_corrections(session_id);
CREATE INDEX idx_corrections_embedding ON agent_corrections
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_corrections_pending ON agent_corrections(embedding_status)
  WHERE embedding_status = 'pending';

ALTER TABLE agent_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corrections_select" ON agent_corrections
  FOR SELECT USING (tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid));

CREATE POLICY "corrections_insert" ON agent_corrections
  FOR INSERT WITH CHECK (tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid));

-- ── search_similar_corrections RPC ──
CREATE OR REPLACE FUNCTION search_similar_corrections(
  query_embedding vector(768),
  tenant_filter uuid DEFAULT NULL,
  correction_type_filter text DEFAULT NULL,
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  correction_id uuid,
  original_response text,
  correction_text text,
  correction_type text,
  context_summary text,
  score float
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    c.id AS correction_id,
    c.original_response,
    c.correction_text,
    c.correction_type,
    c.context_summary,
    1 - (c.embedding <=> query_embedding) AS score
  FROM agent_corrections c
  WHERE
    c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) >= similarity_threshold
    AND (
      tenant_filter IS NULL
      OR c.tenant_id = tenant_filter
    )
    AND (
      correction_type_filter IS NULL
      OR c.correction_type = correction_type_filter
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
