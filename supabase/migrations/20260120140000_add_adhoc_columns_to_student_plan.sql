-- ============================================
-- student_plan 테이블에 ad-hoc 플랜 지원 컬럼 추가
-- ============================================
-- 목표: student_plan에서 ad_hoc_plans 기능을 통합 지원
-- Phase 3.1: 단발성 플랜 통합
-- ============================================

BEGIN;

-- ============================================
-- 1. 기본 ad-hoc 식별 컬럼
-- ============================================

-- is_adhoc: 단발성(빠른 추가) 플랜 구분
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS is_adhoc BOOLEAN DEFAULT false;

COMMENT ON COLUMN student_plan.is_adhoc IS
'단발성(빠른 추가) 플랜 여부. true: ad-hoc 플랜, false: 일반 계획 플랜. Phase 3.1에서 추가.';

-- ============================================
-- 2. UI 표시용 컬럼
-- ============================================

-- description: 플랜 설명 (memo와 별도로 사용자 입력용)
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;

COMMENT ON COLUMN student_plan.description IS
'플랜 설명. 사용자가 입력한 상세 설명. memo는 내부 메모용.';

-- color: 플랜 색상 (CSS 색상값)
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT NULL;

COMMENT ON COLUMN student_plan.color IS
'플랜 표시 색상 (CSS 색상값, 예: #3B82F6). 자유 학습 유형별 색상 구분.';

-- icon: 플랜 아이콘 (lucide 아이콘명)
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT NULL;

COMMENT ON COLUMN student_plan.icon IS
'플랜 아이콘 이름 (lucide 아이콘, 예: BookOpen). 자유 학습 유형별 아이콘.';

-- tags: 태그 배열
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN student_plan.tags IS
'플랜 태그 배열. 분류 및 필터링용.';

-- priority: 우선순위
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

COMMENT ON COLUMN student_plan.priority IS
'플랜 우선순위. 높을수록 우선. 기본값 0.';

-- ============================================
-- 3. 타이머 관련 컬럼 (ad_hoc_plans 호환)
-- ============================================

-- started_at: 학습 시작 시간
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN student_plan.started_at IS
'학습 시작 시간 (타이머 시작). ad_hoc_plans와 호환.';

-- completed_at: 학습 완료 시간
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN student_plan.completed_at IS
'학습 완료 시간 (타이머 종료). ad_hoc_plans와 호환.';

-- actual_minutes: 실제 학습 시간 (분)
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS actual_minutes INTEGER DEFAULT NULL;

COMMENT ON COLUMN student_plan.actual_minutes IS
'실제 학습 시간 (분). 타이머로 측정된 값.';

-- paused_at: 일시정지 시간
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN student_plan.paused_at IS
'마지막 일시정지 시간. 타이머 재개 시 사용.';

-- ============================================
-- 4. 인덱스 추가
-- ============================================

-- is_adhoc 인덱스 (ad-hoc 플랜 필터링용)
CREATE INDEX IF NOT EXISTS idx_student_plan_is_adhoc
ON student_plan (is_adhoc)
WHERE is_adhoc = true;

-- 복합 인덱스: 학생 + 날짜 + ad-hoc (Today 페이지용)
CREATE INDEX IF NOT EXISTS idx_student_plan_student_date_adhoc
ON student_plan (student_id, plan_date, is_adhoc)
WHERE is_adhoc = true;

-- 복합 인덱스: 학생 + 날짜 + 컨테이너 (Today 컨테이너용)
CREATE INDEX IF NOT EXISTS idx_student_plan_student_date_container
ON student_plan (student_id, plan_date, container_type);

-- ============================================
-- 5. 통합 조회 뷰 (선택적)
-- ============================================

-- 참고: 뷰 대신 RPC 사용을 권장 (성능 및 유연성)
-- 아래 뷰는 기존 데이터와 새 데이터 통합 조회용 참조

-- DROP VIEW IF EXISTS unified_adhoc_plans;
-- CREATE VIEW unified_adhoc_plans AS
-- SELECT
--   id,
--   student_id,
--   tenant_id,
--   plan_group_id,
--   plan_date,
--   content_title as title,
--   description,
--   content_type,
--   estimated_minutes,
--   actual_minutes,
--   status,
--   container_type,
--   start_time,
--   end_time,
--   started_at,
--   completed_at,
--   simple_completed_at,
--   simple_completion,
--   paused_at,
--   paused_duration_seconds,
--   pause_count,
--   color,
--   icon,
--   tags,
--   priority,
--   order_index,
--   planned_start_page_or_time as page_range_start,
--   planned_end_page_or_time as page_range_end,
--   flexible_content_id,
--   created_at,
--   updated_at,
--   'student_plan' as source_table
-- FROM student_plan
-- WHERE is_adhoc = true
-- UNION ALL
-- SELECT
--   id,
--   student_id,
--   tenant_id,
--   plan_group_id,
--   plan_date,
--   title,
--   description,
--   content_type,
--   estimated_minutes,
--   actual_minutes,
--   status,
--   container_type,
--   start_time,
--   end_time,
--   started_at,
--   completed_at,
--   simple_completed_at,
--   simple_completion,
--   paused_at,
--   paused_duration_seconds,
--   pause_count,
--   color,
--   icon,
--   tags,
--   priority,
--   order_index,
--   page_range_start,
--   page_range_end,
--   flexible_content_id,
--   created_at,
--   updated_at,
--   'ad_hoc_plans' as source_table
-- FROM ad_hoc_plans;

COMMIT;

-- ============================================
-- 롤백 스크립트 (필요시 수동 실행)
-- ============================================
-- BEGIN;
--
-- ALTER TABLE student_plan DROP COLUMN IF EXISTS is_adhoc;
-- ALTER TABLE student_plan DROP COLUMN IF EXISTS description;
-- ALTER TABLE student_plan DROP COLUMN IF EXISTS color;
-- ALTER TABLE student_plan DROP COLUMN IF EXISTS icon;
-- ALTER TABLE student_plan DROP COLUMN IF EXISTS tags;
-- ALTER TABLE student_plan DROP COLUMN IF EXISTS priority;
-- ALTER TABLE student_plan DROP COLUMN IF EXISTS started_at;
-- ALTER TABLE student_plan DROP COLUMN IF EXISTS completed_at;
-- ALTER TABLE student_plan DROP COLUMN IF EXISTS actual_minutes;
-- ALTER TABLE student_plan DROP COLUMN IF EXISTS paused_at;
--
-- DROP INDEX IF EXISTS idx_student_plan_is_adhoc;
-- DROP INDEX IF EXISTS idx_student_plan_student_date_adhoc;
-- DROP INDEX IF EXISTS idx_student_plan_student_date_container;
--
-- COMMIT;
