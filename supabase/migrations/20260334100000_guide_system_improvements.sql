-- ============================================================
-- CMS 가이드 시스템 개선: 트랜잭션 RPC + 임베딩 상태 + 원자적 카운터 + 인기 가이드 집계
-- ============================================================

-- 1. 매핑 교체 트랜잭션 RPC (DELETE+INSERT 원자적 실행)
-- ============================================================

-- 1-a. 과목 매핑 교체 (트랜잭션)
CREATE OR REPLACE FUNCTION replace_guide_subject_mappings(
  p_guide_id uuid,
  p_subject_ids uuid[],
  p_curriculum_revision_ids uuid[] DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM exploration_guide_subject_mappings WHERE guide_id = p_guide_id;

  IF array_length(p_subject_ids, 1) IS NOT NULL THEN
    INSERT INTO exploration_guide_subject_mappings (guide_id, subject_id, curriculum_revision_id)
    SELECT
      p_guide_id,
      p_subject_ids[i],
      CASE WHEN p_curriculum_revision_ids IS NOT NULL AND i <= array_length(p_curriculum_revision_ids, 1)
           THEN p_curriculum_revision_ids[i]
           ELSE NULL
      END
    FROM generate_series(1, array_length(p_subject_ids, 1)) AS i;
  END IF;
END;
$$;

-- 1-b. 계열 매핑 교체 (트랜잭션)
CREATE OR REPLACE FUNCTION replace_guide_career_mappings(
  p_guide_id uuid,
  p_career_field_ids bigint[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM exploration_guide_career_mappings WHERE guide_id = p_guide_id;

  IF array_length(p_career_field_ids, 1) IS NOT NULL THEN
    INSERT INTO exploration_guide_career_mappings (guide_id, career_field_id)
    SELECT p_guide_id, unnest(p_career_field_ids);
  END IF;
END;
$$;

-- 1-c. 소분류 매핑 교체 (트랜잭션)
CREATE OR REPLACE FUNCTION replace_guide_classification_mappings(
  p_guide_id uuid,
  p_classification_ids int[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM exploration_guide_classification_mappings WHERE guide_id = p_guide_id;

  IF array_length(p_classification_ids, 1) IS NOT NULL THEN
    INSERT INTO exploration_guide_classification_mappings (guide_id, classification_id)
    SELECT p_guide_id, unnest(p_classification_ids);
  END IF;
END;
$$;

-- 2. 임베딩 상태 추적 컬럼
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exploration_guide_content' AND column_name = 'embedding_status'
  ) THEN
    ALTER TABLE exploration_guide_content
    ADD COLUMN embedding_status varchar(20) DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'completed', 'failed'));
  END IF;
END $$;

-- 기존 임베딩이 있는 행은 completed로 마킹
UPDATE exploration_guide_content
SET embedding_status = 'completed'
WHERE embedding IS NOT NULL AND embedding_status = 'pending';

-- 인덱스: 실패/미완료 임베딩 필터용
CREATE INDEX IF NOT EXISTS idx_egc_embedding_status
ON exploration_guide_content (embedding_status)
WHERE embedding_status IN ('pending', 'failed');

-- 3. suggested_topics 원자적 카운트 증가 RPC
-- ============================================================

CREATE OR REPLACE FUNCTION increment_topic_used_count(p_topic_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE suggested_topics
  SET used_count = used_count + 1
  WHERE id = p_topic_id;
$$;

-- 4. 인기 가이드 집계 RPC (3-step N+1 → 단일 쿼리)
-- ============================================================

CREATE OR REPLACE FUNCTION find_popular_guides_by_classification(
  p_classification_ids int[],
  p_limit int DEFAULT 10
) RETURNS TABLE (
  id uuid,
  title text,
  guide_type varchar,
  assignment_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.title,
    g.guide_type,
    COUNT(a.id) AS assignment_count
  FROM exploration_guides g
  JOIN exploration_guide_classification_mappings m ON m.guide_id = g.id
  LEFT JOIN exploration_guide_assignments a ON a.guide_id = g.id
  WHERE m.classification_id = ANY(p_classification_ids)
    AND g.status = 'approved'
    AND g.is_latest = true
  GROUP BY g.id, g.title, g.guide_type
  ORDER BY assignment_count DESC
  LIMIT p_limit;
$$;
