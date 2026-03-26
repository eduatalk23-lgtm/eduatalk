-- ============================================================
-- 벡터 검색 유사도 임계값 기본값 0.3 → 0.45 상향
-- 낮은 임계값으로 인한 관련 없는 결과 반환 방지
-- ============================================================

CREATE OR REPLACE FUNCTION search_guides(
  query_embedding vector(768),
  career_filter bigint DEFAULT NULL,
  subject_filter uuid DEFAULT NULL,
  guide_type_filter text DEFAULT NULL,
  match_count int DEFAULT 10,
  similarity_threshold float DEFAULT 0.45,
  classification_filter int DEFAULT NULL
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
    gc.embedding IS NOT NULL
    AND 1 - (gc.embedding <=> query_embedding) >= similarity_threshold
    AND g.status = 'approved'
    AND (
      career_filter IS NULL
      OR EXISTS (
        SELECT 1 FROM exploration_guide_career_mappings cm
        WHERE cm.guide_id = g.id AND cm.career_field_id = career_filter
      )
    )
    AND (
      subject_filter IS NULL
      OR EXISTS (
        SELECT 1 FROM exploration_guide_subject_mappings sm
        WHERE sm.guide_id = g.id AND sm.subject_id = subject_filter
      )
    )
    AND (
      guide_type_filter IS NULL
      OR g.guide_type = guide_type_filter
    )
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
