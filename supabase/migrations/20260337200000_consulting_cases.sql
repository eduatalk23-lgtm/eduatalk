-- ============================================
-- Self-Evolving Agent: 케이스 메모리
-- consulting_cases + search_similar_cases RPC
-- ============================================

CREATE TABLE consulting_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  student_grade SMALLINT,
  school_category TEXT,
  target_major TEXT,
  curriculum_revision TEXT,
  diagnosis_summary TEXT NOT NULL,
  strategy_summary TEXT NOT NULL,
  key_insights TEXT[] DEFAULT '{}',
  outcome TEXT,
  outcome_score SMALLINT CHECK (outcome_score IS NULL OR (outcome_score >= 1 AND outcome_score <= 5)),
  embedding vector(768),
  embedding_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cases_embedding ON consulting_cases
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_cases_tenant ON consulting_cases(tenant_id, created_at DESC);
CREATE INDEX idx_cases_embedding_status ON consulting_cases(embedding_status)
  WHERE embedding_status = 'pending';

ALTER TABLE consulting_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cases_select" ON consulting_cases
  FOR SELECT USING (tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid));

CREATE POLICY "cases_insert" ON consulting_cases
  FOR INSERT WITH CHECK (tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid));

CREATE POLICY "cases_update" ON consulting_cases
  FOR UPDATE USING (tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid));

-- ── search_similar_cases RPC ──
-- search_guides 패턴 동일: 벡터 유사도 + 메타데이터 필터
CREATE OR REPLACE FUNCTION search_similar_cases(
  query_embedding vector(768),
  tenant_filter uuid DEFAULT NULL,
  grade_filter smallint DEFAULT NULL,
  major_filter text DEFAULT NULL,
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  case_id uuid,
  student_grade smallint,
  target_major text,
  diagnosis_summary text,
  strategy_summary text,
  key_insights text[],
  outcome text,
  outcome_score smallint,
  score float
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    c.id AS case_id,
    c.student_grade,
    c.target_major,
    c.diagnosis_summary,
    c.strategy_summary,
    c.key_insights,
    c.outcome,
    c.outcome_score,
    1 - (c.embedding <=> query_embedding) AS score
  FROM consulting_cases c
  WHERE
    c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) >= similarity_threshold
    AND (
      tenant_filter IS NULL
      OR c.tenant_id = tenant_filter
    )
    AND (
      grade_filter IS NULL
      OR c.student_grade = grade_filter
    )
    AND (
      major_filter IS NULL
      OR c.target_major ILIKE '%' || major_filter || '%'
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
