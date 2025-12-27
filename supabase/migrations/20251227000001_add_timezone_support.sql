-- =====================================================
-- 타임존 기반 플랜 생성 시스템 지원
-- =====================================================
-- 2단계 플랜 생성 방식 지원:
-- 1. 타임존(스케줄 프레임) 먼저 생성
-- 2. 콘텐츠를 개별적으로 추가하며 각각 1730 로직 옵션 설정
-- =====================================================

-- 1. plan_groups 테이블 확장 (타임존 역할)
-- =====================================================

-- 타임존 전용 모드 플래그
ALTER TABLE plan_groups
  ADD COLUMN IF NOT EXISTS is_timezone_only boolean DEFAULT false;

COMMENT ON COLUMN plan_groups.is_timezone_only IS '타임존 전용 모드 (콘텐츠 없이 스케줄 프레임만 저장)';

-- 타임존 상태 (draft -> ready -> active)
ALTER TABLE plan_groups
  ADD COLUMN IF NOT EXISTS timezone_status text DEFAULT 'draft';

COMMENT ON COLUMN plan_groups.timezone_status IS '타임존 상태: draft | ready | active';

-- 새 콘텐츠 추가 시 기본 스케줄러 옵션
ALTER TABLE plan_groups
  ADD COLUMN IF NOT EXISTS default_scheduler_options jsonb;

COMMENT ON COLUMN plan_groups.default_scheduler_options IS '타임존의 기본 1730 스케줄러 옵션';

-- 타임존 조회 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_plan_groups_timezone
  ON plan_groups(student_id, timezone_status)
  WHERE is_timezone_only = true;


-- 2. plan_contents 테이블 확장 (콘텐츠별 1730 로직)
-- =====================================================

-- 스케줄러 모드 (inherit: 플랜 그룹 설정 상속)
ALTER TABLE plan_contents
  ADD COLUMN IF NOT EXISTS scheduler_mode text DEFAULT 'inherit';

COMMENT ON COLUMN plan_contents.scheduler_mode IS '스케줄러 모드: inherit | strategy | weakness | custom';

-- 콘텐츠별 스케줄러 옵션
ALTER TABLE plan_contents
  ADD COLUMN IF NOT EXISTS content_scheduler_options jsonb;

COMMENT ON COLUMN plan_contents.content_scheduler_options IS '콘텐츠별 1730 로직 옵션 (study_days, review_days, weekly_allocation_days 등)';

-- 플랜 생성 상태
ALTER TABLE plan_contents
  ADD COLUMN IF NOT EXISTS generation_status text DEFAULT 'pending';

COMMENT ON COLUMN plan_contents.generation_status IS '플랜 생성 상태: pending | generated | modified';

-- 콘텐츠별 스케줄러 모드 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_plan_contents_scheduler_mode
  ON plan_contents(plan_group_id, scheduler_mode);


-- 3. student_plan 테이블 확장 (복습 그룹핑)
-- =====================================================

-- 복습 그룹 ID (콘텐츠별 그룹핑)
ALTER TABLE student_plan
  ADD COLUMN IF NOT EXISTS review_group_id uuid;

COMMENT ON COLUMN student_plan.review_group_id IS '복습일 그룹 ID (같은 콘텐츠의 주차별 복습 그룹)';

-- 복습 원본 콘텐츠 ID 배열
ALTER TABLE student_plan
  ADD COLUMN IF NOT EXISTS review_source_content_ids uuid[];

COMMENT ON COLUMN student_plan.review_source_content_ids IS '이 복습 플랜의 원본 콘텐츠 ID들';

-- 복습 그룹 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_student_plan_review_group
  ON student_plan(review_group_id)
  WHERE review_group_id IS NOT NULL;


-- 4. 유효성 검사 제약 조건
-- =====================================================

-- timezone_status 값 검증
ALTER TABLE plan_groups
  DROP CONSTRAINT IF EXISTS plan_groups_timezone_status_check;

ALTER TABLE plan_groups
  ADD CONSTRAINT plan_groups_timezone_status_check
  CHECK (timezone_status IS NULL OR timezone_status IN ('draft', 'ready', 'active'));

-- scheduler_mode 값 검증
ALTER TABLE plan_contents
  DROP CONSTRAINT IF EXISTS plan_contents_scheduler_mode_check;

ALTER TABLE plan_contents
  ADD CONSTRAINT plan_contents_scheduler_mode_check
  CHECK (scheduler_mode IS NULL OR scheduler_mode IN ('inherit', 'strategy', 'weakness', 'custom'));

-- generation_status 값 검증
ALTER TABLE plan_contents
  DROP CONSTRAINT IF EXISTS plan_contents_generation_status_check;

ALTER TABLE plan_contents
  ADD CONSTRAINT plan_contents_generation_status_check
  CHECK (generation_status IS NULL OR generation_status IN ('pending', 'generated', 'modified'));
