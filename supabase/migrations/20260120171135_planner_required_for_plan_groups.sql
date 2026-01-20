-- ============================================
-- 플래너 필수화 마이그레이션 (Phase 4)
-- ============================================
-- 목표: plan_groups에 planner_id 필수화 지원
-- - 기존 orphan plan_groups 처리
-- - scheduler_options 일관성 보장
-- ============================================

-- 트랜잭션 시작
BEGIN;

-- ============================================
-- 1. 진단 쿼리 (실행 전 상태 확인)
-- ============================================

-- 1.1 planner_id가 없는 plan_groups 개수 확인
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM plan_groups
  WHERE planner_id IS NULL
    AND status NOT IN ('deleted', 'archived');

  RAISE NOTICE '[진단] planner_id가 없는 활성 plan_groups: % 개', orphan_count;
END $$;

-- ============================================
-- 2. Orphan Plan Groups 자동 연결 (선택적)
-- ============================================

-- 2.1 학생별 기본 플래너 조회 함수 생성
CREATE OR REPLACE FUNCTION get_default_planner_for_student(
  p_student_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS UUID AS $$
DECLARE
  v_planner_id UUID;
BEGIN
  -- 1순위: 기간이 겹치는 active 플래너
  SELECT id INTO v_planner_id
  FROM planners
  WHERE student_id = p_student_id
    AND status = 'active'
    AND period_start <= p_period_end
    AND period_end >= p_period_start
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_planner_id IS NOT NULL THEN
    RETURN v_planner_id;
  END IF;

  -- 2순위: 가장 최근 active 플래너
  SELECT id INTO v_planner_id
  FROM planners
  WHERE student_id = p_student_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_planner_id IS NOT NULL THEN
    RETURN v_planner_id;
  END IF;

  -- 3순위: 가장 최근 draft 플래너
  SELECT id INTO v_planner_id
  FROM planners
  WHERE student_id = p_student_id
    AND status = 'draft'
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_planner_id;
END;
$$ LANGUAGE plpgsql;

-- 2.2 Orphan plan_groups 자동 연결 (DRY RUN - 실제 업데이트는 주석 해제 후 실행)
-- 주의: 실제 운영 환경에서는 먼저 SELECT로 확인 후 UPDATE 실행

-- DRY RUN: 연결 대상 확인
DO $$
DECLARE
  rec RECORD;
  v_planner_id UUID;
  link_count INTEGER := 0;
BEGIN
  RAISE NOTICE '[DRY RUN] Orphan plan_groups 연결 시뮬레이션 시작...';

  FOR rec IN
    SELECT pg.id, pg.student_id, pg.period_start, pg.period_end, pg.name
    FROM plan_groups pg
    WHERE pg.planner_id IS NULL
      AND pg.status NOT IN ('deleted', 'archived')
      AND pg.student_id IS NOT NULL
  LOOP
    v_planner_id := get_default_planner_for_student(
      rec.student_id,
      rec.period_start,
      rec.period_end
    );

    IF v_planner_id IS NOT NULL THEN
      link_count := link_count + 1;
      RAISE NOTICE '  [연결 가능] plan_group: % -> planner: %', rec.id, v_planner_id;
    ELSE
      RAISE NOTICE '  [연결 불가] plan_group: % (적합한 플래너 없음)', rec.id;
    END IF;
  END LOOP;

  RAISE NOTICE '[DRY RUN 완료] 연결 가능한 plan_groups: % 개', link_count;
END $$;

-- 실제 연결 (주석 해제하여 실행)
-- UPDATE plan_groups pg
-- SET planner_id = get_default_planner_for_student(
--   pg.student_id,
--   pg.period_start,
--   pg.period_end
-- ),
-- updated_at = NOW()
-- WHERE pg.planner_id IS NULL
--   AND pg.status NOT IN ('deleted', 'archived')
--   AND pg.student_id IS NOT NULL
--   AND get_default_planner_for_student(pg.student_id, pg.period_start, pg.period_end) IS NOT NULL;

-- ============================================
-- 3. Scheduler Options 동기화
-- ============================================

-- 3.1 플래너 설정을 plan_groups에 동기화하는 함수
CREATE OR REPLACE FUNCTION sync_planner_scheduler_options_to_group(
  p_plan_group_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_planner RECORD;
  v_current_options JSONB;
  v_new_options JSONB;
BEGIN
  -- Plan Group의 현재 옵션과 연결된 플래너 정보 조회
  SELECT
    pg.scheduler_options,
    p.default_scheduler_options,
    p.default_scheduler_type
  INTO v_current_options, v_planner.default_scheduler_options, v_planner.default_scheduler_type
  FROM plan_groups pg
  LEFT JOIN planners p ON pg.planner_id = p.id
  WHERE pg.id = p_plan_group_id;

  -- 플래너가 없으면 스킵
  IF v_planner.default_scheduler_options IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 플래너의 study_days, review_days를 plan_group에 동기화
  v_new_options := COALESCE(v_current_options, '{}'::jsonb);

  IF v_planner.default_scheduler_options ? 'study_days' THEN
    v_new_options := jsonb_set(
      v_new_options,
      '{study_days}',
      v_planner.default_scheduler_options->'study_days'
    );
  END IF;

  IF v_planner.default_scheduler_options ? 'review_days' THEN
    v_new_options := jsonb_set(
      v_new_options,
      '{review_days}',
      v_planner.default_scheduler_options->'review_days'
    );
  END IF;

  -- 업데이트
  UPDATE plan_groups
  SET scheduler_options = v_new_options,
      updated_at = NOW()
  WHERE id = p_plan_group_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 3.2 모든 연결된 plan_groups 동기화 (선택적 실행)
-- 주의: 대량 데이터 업데이트 - 먼저 COUNT 확인 후 실행

-- DRY RUN: 동기화 대상 확인
DO $$
DECLARE
  sync_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO sync_count
  FROM plan_groups pg
  JOIN planners p ON pg.planner_id = p.id
  WHERE p.default_scheduler_options IS NOT NULL
    AND pg.status NOT IN ('deleted', 'archived');

  RAISE NOTICE '[동기화 대상] planner 연결된 plan_groups: % 개', sync_count;
END $$;

-- 실제 동기화 (주석 해제하여 실행)
-- DO $$
-- DECLARE
--   rec RECORD;
--   sync_count INTEGER := 0;
-- BEGIN
--   FOR rec IN
--     SELECT pg.id
--     FROM plan_groups pg
--     JOIN planners p ON pg.planner_id = p.id
--     WHERE p.default_scheduler_options IS NOT NULL
--       AND pg.status NOT IN ('deleted', 'archived')
--   LOOP
--     IF sync_planner_scheduler_options_to_group(rec.id) THEN
--       sync_count := sync_count + 1;
--     END IF;
--   END LOOP;
--
--   RAISE NOTICE '[동기화 완료] % 개 plan_groups 업데이트됨', sync_count;
-- END $$;

-- ============================================
-- 4. 검증 쿼리
-- ============================================

-- 4.1 마이그레이션 후 상태 확인
DO $$
DECLARE
  total_groups INTEGER;
  with_planner INTEGER;
  without_planner INTEGER;
  consistent_options INTEGER;
BEGIN
  -- 전체 활성 plan_groups
  SELECT COUNT(*) INTO total_groups
  FROM plan_groups
  WHERE status NOT IN ('deleted', 'archived');

  -- planner_id가 있는 그룹
  SELECT COUNT(*) INTO with_planner
  FROM plan_groups
  WHERE planner_id IS NOT NULL
    AND status NOT IN ('deleted', 'archived');

  -- planner_id가 없는 그룹
  without_planner := total_groups - with_planner;

  -- scheduler_options가 플래너와 일치하는 그룹
  SELECT COUNT(*) INTO consistent_options
  FROM plan_groups pg
  JOIN planners p ON pg.planner_id = p.id
  WHERE pg.status NOT IN ('deleted', 'archived')
    AND (
      (pg.scheduler_options->>'study_days')::int = (p.default_scheduler_options->>'study_days')::int
      OR p.default_scheduler_options IS NULL
      OR p.default_scheduler_options->>'study_days' IS NULL
    );

  RAISE NOTICE '========================================';
  RAISE NOTICE '[마이그레이션 결과 요약]';
  RAISE NOTICE '  전체 활성 plan_groups: %', total_groups;
  RAISE NOTICE '  플래너 연결됨: %', with_planner;
  RAISE NOTICE '  플래너 미연결: %', without_planner;
  RAISE NOTICE '  scheduler_options 일치: %', consistent_options;
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- 5. 향후 제약조건 (선택적)
-- ============================================

-- 5.1 새로 생성되는 plan_groups에 planner_id 필수 제약 (Phase 5에서 활성화)
-- 주의: 기존 데이터가 모두 마이그레이션된 후에만 활성화
-- ALTER TABLE plan_groups
-- ADD CONSTRAINT plan_groups_planner_required
-- CHECK (planner_id IS NOT NULL OR status IN ('deleted', 'archived'));

-- 트랜잭션 커밋
COMMIT;

-- ============================================
-- 롤백 스크립트 (필요시 수동 실행)
-- ============================================
-- BEGIN;
--
-- DROP FUNCTION IF EXISTS get_default_planner_for_student(UUID, DATE, DATE);
-- DROP FUNCTION IF EXISTS sync_planner_scheduler_options_to_group(UUID);
--
-- COMMIT;
