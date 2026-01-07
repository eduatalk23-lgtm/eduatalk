-- ============================================
-- Migration: cleanup_orphan_plan_groups
-- Description: planner_id가 없는 plan_groups 삭제 (플래너 우선순위 정책)
--
-- 이 마이그레이션은 프로젝트가 실 사용 중이 아니므로 안전하게 실행됩니다.
-- planner_id 없이 생성된 모든 plan_groups를 삭제합니다.
-- ============================================

-- 1. 삭제 대상 확인 (로깅용)
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM plan_groups
  WHERE planner_id IS NULL;

  RAISE NOTICE 'planner_id가 없는 plan_groups 수: %', orphan_count;
END $$;

-- 2. planner_id가 없는 plan_groups 삭제
-- CASCADE로 인해 연관 데이터(plan_contents, plan_exclusions, academy_schedules 등)도 함께 삭제됨
DELETE FROM plan_groups
WHERE planner_id IS NULL;

-- 3. 향후 NOT NULL 제약 추가 (선택적 - 현재는 주석 처리)
-- 모든 기존 데이터 정리 후 제약 조건 적용 시 주석 해제
-- ALTER TABLE plan_groups ALTER COLUMN planner_id SET NOT NULL;

-- 4. 정리 완료 확인
DO $$
DECLARE
  remaining_orphans INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_orphans
  FROM plan_groups
  WHERE planner_id IS NULL;

  IF remaining_orphans = 0 THEN
    RAISE NOTICE '정리 완료: planner_id가 없는 plan_groups가 모두 삭제되었습니다.';
  ELSE
    RAISE WARNING '경고: 아직 %개의 orphan plan_groups가 남아있습니다.', remaining_orphans;
  END IF;
END $$;
