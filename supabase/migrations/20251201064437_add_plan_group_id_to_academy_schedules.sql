-- Phase 2: academy_schedules 테이블에 plan_group_id 추가
-- 학원 일정을 플랜 그룹별로 관리하기 위한 스키마 변경

-- 1. academy_schedules 테이블에 plan_group_id 컬럼 추가 (이미 존재하는 경우 스킵)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'academy_schedules' 
    AND column_name = 'plan_group_id'
  ) THEN
    ALTER TABLE academy_schedules
    ADD COLUMN plan_group_id UUID REFERENCES plan_groups(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. 기존 데이터 처리: 가장 최근 플랜 그룹에 할당
-- 각 학생별로 가장 최근에 생성된 플랜 그룹에 학원 일정 할당
UPDATE academy_schedules AS a
SET plan_group_id = (
  SELECT pg.id
  FROM plan_groups pg
  WHERE pg.student_id = a.student_id
    AND pg.deleted_at IS NULL
  ORDER BY pg.created_at DESC
  LIMIT 1
)
WHERE plan_group_id IS NULL;

-- 3. plan_group_id가 NULL인 학원 일정 삭제
-- (플랜 그룹이 없는 학생의 학원 일정 정리)
DELETE FROM academy_schedules WHERE plan_group_id IS NULL;

-- 4. plan_group_id를 NOT NULL로 변경 (컬럼이 존재하고 NULL 허용인 경우만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'academy_schedules' 
    AND column_name = 'plan_group_id'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE academy_schedules
    ALTER COLUMN plan_group_id SET NOT NULL;
  END IF;
END $$;

-- 5. 인덱스 추가
-- plan_group_id 단독 인덱스 (플랜 그룹별 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_academy_schedules_plan_group_id 
ON academy_schedules(plan_group_id);

-- student_id + plan_group_id 조합 인덱스 (학생별 플랜 그룹 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_academy_schedules_student_plan_group 
ON academy_schedules(student_id, plan_group_id);

-- 6. 주석 추가
COMMENT ON COLUMN academy_schedules.plan_group_id IS '학원 일정이 속한 플랜 그룹 ID (플랜 그룹별 독립 관리)';

