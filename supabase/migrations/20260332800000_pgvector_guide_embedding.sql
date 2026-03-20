-- ============================================
-- Phase C: pgvector 임베딩 + 하이브리드 검색
-- exploration_guide_content에 벡터 컬럼 + 검색 RPC
-- ============================================

-- 1. pgvector 확장
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 임베딩 컬럼 추가
ALTER TABLE exploration_guide_content
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 3. HNSW 인덱스 (cosine 유사도)
CREATE INDEX IF NOT EXISTS idx_guide_content_embedding
  ON exploration_guide_content
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. 하이브리드 검색 RPC
CREATE OR REPLACE FUNCTION search_guides(
  query_embedding vector(768),
  career_filter bigint DEFAULT NULL,
  subject_filter uuid DEFAULT NULL,
  guide_type_filter text DEFAULT NULL,
  match_count int DEFAULT 10,
  similarity_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  guide_id uuid,
  title text,
  guide_type text,
  book_title text,
  book_author text,
  motivation text,
  score float
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    g.id AS guide_id,
    g.title,
    g.guide_type,
    g.book_title,
    g.book_author,
    gc.motivation,
    1 - (gc.embedding <=> query_embedding) AS score
  FROM exploration_guide_content gc
  JOIN exploration_guides g ON g.id = gc.guide_id
  WHERE
    -- 임베딩이 있는 가이드만
    gc.embedding IS NOT NULL
    -- 유사도 임계값
    AND 1 - (gc.embedding <=> query_embedding) >= similarity_threshold
    -- 승인된 가이드만
    AND g.status = 'approved'
    -- 계열 필터 (옵션)
    AND (
      career_filter IS NULL
      OR EXISTS (
        SELECT 1 FROM exploration_guide_career_fields cf
        WHERE cf.guide_id = g.id AND cf.career_field_id = career_filter
      )
    )
    -- 과목 필터 (옵션)
    AND (
      subject_filter IS NULL
      OR EXISTS (
        SELECT 1 FROM exploration_guide_subjects gs
        WHERE gs.guide_id = g.id AND gs.subject_id = subject_filter
      )
    )
    -- 유형 필터 (옵션)
    AND (
      guide_type_filter IS NULL
      OR g.guide_type = guide_type_filter
    )
  ORDER BY gc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 5. RPC에 대한 코멘트
COMMENT ON FUNCTION search_guides IS '탐구 가이드 하이브리드 검색: 벡터 유사도 + 메타데이터 필터 (계열, 과목, 유형)';
