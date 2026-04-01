-- ============================================
-- 학술 출처 축적 테이블 (academic_sources)
-- 가이드 출처 수집 시 벡터 검색으로 캐시 조회
-- ============================================

-- 테이블 생성
CREATE TABLE IF NOT EXISTS academic_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  title text NOT NULL,
  authors text[] DEFAULT '{}',
  journal text,
  year integer,
  abstract_snippet text,
  cited_text text,
  source_db text NOT NULL CHECK (source_db IN ('kci', 'dbpia', 'riss', 'scholar', 'scienceall', 'koreascience', 'other')),
  keywords text[] DEFAULT '{}',
  subject_areas text[] DEFAULT '{}',
  career_fields text[] DEFAULT '{}',
  hit_count integer DEFAULT 0,
  embedding vector(768),
  embedding_status varchar(20) DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'completed', 'failed')),
  last_validated_at timestamptz DEFAULT now(),
  is_valid boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_academic_sources_embedding
  ON academic_sources
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_academic_sources_keywords
  ON academic_sources USING gin(keywords);

CREATE INDEX IF NOT EXISTS idx_academic_sources_subject
  ON academic_sources USING gin(subject_areas);

CREATE INDEX IF NOT EXISTS idx_academic_sources_source_db
  ON academic_sources (source_db);

CREATE INDEX IF NOT EXISTS idx_academic_sources_embedding_status
  ON academic_sources (embedding_status)
  WHERE embedding_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_academic_sources_valid
  ON academic_sources (is_valid)
  WHERE is_valid = true;

-- 벡터 검색 RPC
CREATE OR REPLACE FUNCTION search_academic_sources(
  query_embedding vector(768),
  subject_filter text[] DEFAULT NULL,
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.7
)
RETURNS TABLE (
  source_id uuid,
  title text,
  authors text[],
  year integer,
  url text,
  journal text,
  abstract_snippet text,
  cited_text text,
  source_db text,
  score float
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    s.id AS source_id,
    s.title,
    s.authors,
    s.year,
    s.url,
    s.journal,
    s.abstract_snippet,
    s.cited_text,
    s.source_db,
    1 - (s.embedding <=> query_embedding) AS score
  FROM academic_sources s
  WHERE
    s.embedding IS NOT NULL
    AND s.is_valid = true
    AND 1 - (s.embedding <=> query_embedding) >= similarity_threshold
    AND (subject_filter IS NULL OR s.subject_areas && subject_filter)
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- hit_count 증가 함수
CREATE OR REPLACE FUNCTION increment_source_hit_count(source_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE academic_sources
  SET hit_count = hit_count + 1, updated_at = now()
  WHERE id = source_id;
$$;

-- RLS (서비스 역할만 접근)
ALTER TABLE academic_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON academic_sources
  FOR ALL
  USING ((SELECT auth.jwt() ->> 'user_role') IN ('admin', 'consultant'))
  WITH CHECK ((SELECT auth.jwt() ->> 'user_role') IN ('admin', 'consultant'));

CREATE POLICY "service_role_access" ON academic_sources
  FOR ALL
  USING (auth.role() = 'service_role');
