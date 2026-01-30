-- Migration: lunch_time을 non_study_time_blocks에 통합
--
-- 목적: 레거시 lunch_time 필드의 데이터를 non_study_time_blocks의 "점심식사" 타입으로 통합
--
-- 변경 사항:
-- 1. planners 테이블: lunch_time이 있고 non_study_time_blocks에 점심식사가 없는 경우 통합
-- 2. plan_groups 테이블: 동일하게 처리
--
-- 하위 호환성: lunch_time 필드는 유지 (deprecated)

-- ============================================
-- 1. planners 테이블 마이그레이션
-- ============================================

-- lunch_time이 있고 non_study_time_blocks에 점심식사가 없는 planners 업데이트
UPDATE planners
SET non_study_time_blocks = COALESCE(non_study_time_blocks, '[]'::jsonb) || jsonb_build_array(
  jsonb_build_object(
    'type', '점심식사',
    'start_time', lunch_time->>'start',
    'end_time', lunch_time->>'end'
  )
)
WHERE
  lunch_time IS NOT NULL
  AND lunch_time->>'start' IS NOT NULL
  AND lunch_time->>'end' IS NOT NULL
  AND deleted_at IS NULL
  AND (
    non_study_time_blocks IS NULL
    OR non_study_time_blocks = '[]'::jsonb
    OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(non_study_time_blocks) AS elem
      WHERE elem->>'type' = '점심식사'
    )
  );

-- ============================================
-- 2. plan_groups 테이블 마이그레이션
-- ============================================

-- lunch_time이 있고 non_study_time_blocks에 점심식사가 없는 plan_groups 업데이트
UPDATE plan_groups
SET non_study_time_blocks = COALESCE(non_study_time_blocks, '[]'::jsonb) || jsonb_build_array(
  jsonb_build_object(
    'type', '점심식사',
    'start_time', lunch_time->>'start',
    'end_time', lunch_time->>'end'
  )
)
WHERE
  lunch_time IS NOT NULL
  AND lunch_time->>'start' IS NOT NULL
  AND lunch_time->>'end' IS NOT NULL
  AND deleted_at IS NULL
  AND (
    non_study_time_blocks IS NULL
    OR non_study_time_blocks = '[]'::jsonb
    OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(non_study_time_blocks) AS elem
      WHERE elem->>'type' = '점심식사'
    )
  );

-- ============================================
-- 3. 필드 주석 추가 (deprecated 표시)
-- ============================================

COMMENT ON COLUMN planners.lunch_time IS
  '@deprecated non_study_time_blocks의 "점심식사" 타입으로 통합됨. 하위 호환성을 위해 유지.';

COMMENT ON COLUMN plan_groups.lunch_time IS
  '@deprecated non_study_time_blocks의 "점심식사" 타입으로 통합됨. 하위 호환성을 위해 유지.';

-- ============================================
-- 검증 쿼리 (실행 후 확인용)
-- ============================================

-- 마이그레이션 결과 확인 (주석 처리된 상태로 유지)
-- SELECT
--   'planners' as table_name,
--   COUNT(*) as total,
--   COUNT(*) FILTER (WHERE lunch_time IS NOT NULL) as has_lunch_time,
--   COUNT(*) FILTER (
--     WHERE EXISTS (
--       SELECT 1 FROM jsonb_array_elements(non_study_time_blocks) elem
--       WHERE elem->>'type' = '점심식사'
--     )
--   ) as has_lunch_in_blocks
-- FROM planners WHERE deleted_at IS NULL
-- UNION ALL
-- SELECT
--   'plan_groups' as table_name,
--   COUNT(*) as total,
--   COUNT(*) FILTER (WHERE lunch_time IS NOT NULL) as has_lunch_time,
--   COUNT(*) FILTER (
--     WHERE EXISTS (
--       SELECT 1 FROM jsonb_array_elements(non_study_time_blocks) elem
--       WHERE elem->>'type' = '점심식사'
--     )
--   ) as has_lunch_in_blocks
-- FROM plan_groups WHERE deleted_at IS NULL;
