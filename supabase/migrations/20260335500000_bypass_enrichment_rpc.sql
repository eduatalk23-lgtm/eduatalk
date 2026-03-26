-- ============================================
-- 우회학과 enrichment 지원 RPC
-- 교육과정 미보유 학과를 효율적으로 찾기 위한 함수
-- ============================================

-- 동일 대분류 내 교육과정 미보유 학과 검색
-- fallback (2-query 클라이언트 필터링) 대비 단일 쿼리로 성능 향상
CREATE OR REPLACE FUNCTION find_depts_without_curriculum(
  p_major text,
  p_exclude uuid,
  p_limit int DEFAULT 5
)
RETURNS TABLE(id uuid) AS $$
  SELECT ud.id
  FROM public.university_departments ud
  WHERE ud.major_classification = p_major
    AND ud.id != p_exclude
    AND NOT EXISTS (
      SELECT 1 FROM public.department_curriculum dc
      WHERE dc.department_id = ud.id
    )
  LIMIT p_limit;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '';

-- RPC 실행 권한
GRANT EXECUTE ON FUNCTION find_depts_without_curriculum(text, uuid, int)
  TO authenticated;
