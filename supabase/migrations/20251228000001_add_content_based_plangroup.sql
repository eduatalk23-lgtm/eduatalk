-- =====================================================
-- Content-based PlanGroup Creation Support
-- Migration: 20251228000001
-- =====================================================

-- 1. plan_groups 테이블 확장
-- =====================================================

-- 템플릿 참조 (콘텐츠별 플랜그룹이 상속받을 위저드 플랜그룹)
ALTER TABLE plan_groups ADD COLUMN IF NOT EXISTS
  template_plan_group_id UUID REFERENCES plan_groups(id);

COMMENT ON COLUMN plan_groups.template_plan_group_id IS
  'Reference to wizard plan group used as template for content-based plan groups';

-- 학습 유형 (전략/취약)
ALTER TABLE plan_groups ADD COLUMN IF NOT EXISTS
  study_type TEXT;

COMMENT ON COLUMN plan_groups.study_type IS
  'Study type for content-based plan groups: strategy (주N일) | weakness (매일)';

-- 전략 과목: 주당 학습일 수 (2-4일)
ALTER TABLE plan_groups ADD COLUMN IF NOT EXISTS
  strategy_days_per_week INTEGER;

COMMENT ON COLUMN plan_groups.strategy_days_per_week IS
  'Days per week for strategy type (2-4), only used when study_type = strategy';

-- creation_mode 컬럼 추가 (인덱스 생성 전에 먼저 추가)
ALTER TABLE plan_groups ADD COLUMN IF NOT EXISTS
  creation_mode TEXT DEFAULT 'wizard';

COMMENT ON COLUMN plan_groups.creation_mode IS
  'How this plan group was created: wizard (7-step), content_based (4-step simplified), template, camp';

-- 2. 제약조건
-- =====================================================

-- study_type 값 체크
DO $$
BEGIN
  ALTER TABLE plan_groups
    DROP CONSTRAINT IF EXISTS plan_groups_study_type_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

ALTER TABLE plan_groups
  ADD CONSTRAINT plan_groups_study_type_check
  CHECK (study_type IS NULL OR study_type IN ('strategy', 'weakness'));

-- strategy_days_per_week 범위 체크
DO $$
BEGIN
  ALTER TABLE plan_groups
    DROP CONSTRAINT IF EXISTS plan_groups_strategy_days_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

ALTER TABLE plan_groups
  ADD CONSTRAINT plan_groups_strategy_days_check
  CHECK (strategy_days_per_week IS NULL OR strategy_days_per_week BETWEEN 2 AND 4);

-- creation_mode 제약조건
DO $$
BEGIN
  ALTER TABLE plan_groups
    DROP CONSTRAINT IF EXISTS plan_groups_creation_mode_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

ALTER TABLE plan_groups
  ADD CONSTRAINT plan_groups_creation_mode_check
  CHECK (creation_mode IS NULL OR creation_mode IN ('wizard', 'content_based', 'template', 'camp'));

-- 3. 인덱스
-- =====================================================

-- 템플릿 참조 인덱스 (콘텐츠별 플랜그룹 조회 시)
CREATE INDEX IF NOT EXISTS idx_plan_groups_template
  ON plan_groups(template_plan_group_id)
  WHERE template_plan_group_id IS NOT NULL;

-- study_type 인덱스
CREATE INDEX IF NOT EXISTS idx_plan_groups_study_type
  ON plan_groups(study_type)
  WHERE study_type IS NOT NULL;

-- 학생별 활성 콘텐츠 플랜그룹 조회용 (9개 제한 체크)
CREATE INDEX IF NOT EXISTS idx_plan_groups_student_content_based
  ON plan_groups(student_id, status)
  WHERE creation_mode = 'content_based' AND status = 'active';
