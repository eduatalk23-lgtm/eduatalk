-- ============================================================
-- Phase C: search_guides RPC에 classification_filter 추가
--
-- 기존 파라미터 유지 + classification_filter 옵션 추가
-- exploration_guide_classification_mappings 테이블 활용
-- ============================================================

CREATE OR REPLACE FUNCTION search_guides(
  query_embedding vector(768),
  career_filter bigint DEFAULT NULL,
  subject_filter uuid DEFAULT NULL,
  guide_type_filter text DEFAULT NULL,
  match_count int DEFAULT 10,
  similarity_threshold float DEFAULT 0.3,
  classification_filter int DEFAULT NULL  -- NEW: KEDI 소분류 필터
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
        SELECT 1 FROM exploration_guide_career_mappings cm
        WHERE cm.guide_id = g.id AND cm.career_field_id = career_filter
      )
    )
    -- 과목 필터 (옵션)
    AND (
      subject_filter IS NULL
      OR EXISTS (
        SELECT 1 FROM exploration_guide_subject_mappings sm
        WHERE sm.guide_id = g.id AND sm.subject_id = subject_filter
      )
    )
    -- 유형 필터 (옵션)
    AND (
      guide_type_filter IS NULL
      OR g.guide_type = guide_type_filter
    )
    -- KEDI 소분류 필터 (옵션)
    AND (
      classification_filter IS NULL
      OR EXISTS (
        SELECT 1 FROM exploration_guide_classification_mappings clm
        WHERE clm.guide_id = g.id AND clm.classification_id = classification_filter
      )
    )
  ORDER BY gc.embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMENT ON FUNCTION search_guides IS '탐구 가이드 하이브리드 검색: 벡터 유사도 + 메타데이터 필터 (계열, 과목, 유형, KEDI 소분류)';
