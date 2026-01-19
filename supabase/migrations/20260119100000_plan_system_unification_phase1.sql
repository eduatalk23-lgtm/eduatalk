-- ============================================
-- 플랜 시스템 통합 Phase 1: 기반 구축
-- ============================================
-- 목표: 새 구조의 기반을 마련하되 기존 기능 유지
-- 관련 문서: docs/architecture/plan-system-unification.md
-- ============================================

-- 트랜잭션 시작
BEGIN;

-- ============================================
-- 1. planners 테이블 확장
-- ============================================

-- 1.1 scheduler_options 컬럼 추가 (plan_groups에서 이동할 조율 정보)
-- 이 컬럼은 여러 plan_group을 조율하는 스케줄러 옵션을 저장
ALTER TABLE planners
ADD COLUMN IF NOT EXISTS scheduler_options JSONB DEFAULT NULL;

-- 컬럼 코멘트 추가
COMMENT ON COLUMN planners.scheduler_options IS
'스케줄러 조율 옵션 (plan_groups에서 이동). subject_allocations, content_allocations 등 여러 콘텐츠 조율 정보 포함. Phase 2에서 활성화됨.';

-- ============================================
-- 2. plan_groups 테이블 확장 (단일 콘텐츠 모드)
-- ============================================

-- 2.1 단일 콘텐츠 정보 컬럼 추가 (plan_contents 대체)
-- content_type: 콘텐츠 유형 (book, lecture, custom 등)
ALTER TABLE plan_groups
ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) DEFAULT NULL;

-- content_id: 콘텐츠 ID (외래키 - 제약조건은 Phase 4에서 추가)
ALTER TABLE plan_groups
ADD COLUMN IF NOT EXISTS content_id UUID DEFAULT NULL;

-- master_content_id: 마스터 콘텐츠 ID (선택적)
ALTER TABLE plan_groups
ADD COLUMN IF NOT EXISTS master_content_id UUID DEFAULT NULL;

-- start_range: 학습 범위 시작 (페이지 또는 에피소드 번호)
ALTER TABLE plan_groups
ADD COLUMN IF NOT EXISTS start_range INTEGER DEFAULT NULL;

-- end_range: 학습 범위 종료
ALTER TABLE plan_groups
ADD COLUMN IF NOT EXISTS end_range INTEGER DEFAULT NULL;

-- start_detail_id: 세부 시작 위치 ID (목차 등)
ALTER TABLE plan_groups
ADD COLUMN IF NOT EXISTS start_detail_id UUID DEFAULT NULL;

-- end_detail_id: 세부 종료 위치 ID (목차 등)
ALTER TABLE plan_groups
ADD COLUMN IF NOT EXISTS end_detail_id UUID DEFAULT NULL;

-- 2.2 단일 콘텐츠 모드 플래그 (마이그레이션 중 구분용)
ALTER TABLE plan_groups
ADD COLUMN IF NOT EXISTS is_single_content BOOLEAN DEFAULT false;

-- 컬럼 코멘트 추가
COMMENT ON COLUMN plan_groups.content_type IS
'단일 콘텐츠 모드: 콘텐츠 유형 (book, lecture, custom). is_single_content=true일 때 사용.';

COMMENT ON COLUMN plan_groups.content_id IS
'단일 콘텐츠 모드: 콘텐츠 ID. plan_contents 테이블 대체.';

COMMENT ON COLUMN plan_groups.master_content_id IS
'단일 콘텐츠 모드: 마스터 콘텐츠 ID (선택적).';

COMMENT ON COLUMN plan_groups.start_range IS
'단일 콘텐츠 모드: 학습 범위 시작 (페이지/에피소드).';

COMMENT ON COLUMN plan_groups.end_range IS
'단일 콘텐츠 모드: 학습 범위 종료.';

COMMENT ON COLUMN plan_groups.start_detail_id IS
'단일 콘텐츠 모드: 세부 시작 위치 ID (목차 항목 등).';

COMMENT ON COLUMN plan_groups.end_detail_id IS
'단일 콘텐츠 모드: 세부 종료 위치 ID.';

COMMENT ON COLUMN plan_groups.is_single_content IS
'단일 콘텐츠 모드 플래그. true: 새 구조 (content_* 컬럼 사용), false: 레거시 (plan_contents 테이블 사용). Phase 5에서 제거 예정.';

-- ============================================
-- 3. 인덱스 추가
-- ============================================

-- 3.1 planners.scheduler_options 인덱스 (JSONB 검색용)
CREATE INDEX IF NOT EXISTS idx_planners_scheduler_options_gin
ON planners USING gin (scheduler_options);

-- 3.2 plan_groups 단일 콘텐츠 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_plan_groups_content_id
ON plan_groups (content_id)
WHERE content_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_plan_groups_is_single_content
ON plan_groups (is_single_content)
WHERE is_single_content = true;

-- 복합 인덱스: 단일 콘텐츠 + 플래너 조회용
CREATE INDEX IF NOT EXISTS idx_plan_groups_planner_single_content
ON plan_groups (planner_id, is_single_content)
WHERE planner_id IS NOT NULL AND is_single_content = true;

-- ============================================
-- 4. RLS 정책 업데이트 (필요시)
-- ============================================

-- 새 컬럼들은 기존 RLS 정책으로 자동 보호됨
-- 추가 정책이 필요한 경우 여기에 작성

-- ============================================
-- 5. 검증 쿼리
-- ============================================

-- 마이그레이션 후 검증용 (실행하지 않음, 참조용)
-- SELECT
--   column_name,
--   data_type,
--   is_nullable,
--   column_default
-- FROM information_schema.columns
-- WHERE table_name = 'planners'
--   AND column_name = 'scheduler_options';

-- SELECT
--   column_name,
--   data_type,
--   is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'plan_groups'
--   AND column_name IN ('content_type', 'content_id', 'is_single_content');

-- 트랜잭션 커밋
COMMIT;

-- ============================================
-- 롤백 스크립트 (필요시 수동 실행)
-- ============================================
-- BEGIN;
--
-- -- planners 컬럼 제거
-- ALTER TABLE planners DROP COLUMN IF EXISTS scheduler_options;
--
-- -- plan_groups 컬럼 제거
-- ALTER TABLE plan_groups DROP COLUMN IF EXISTS content_type;
-- ALTER TABLE plan_groups DROP COLUMN IF EXISTS content_id;
-- ALTER TABLE plan_groups DROP COLUMN IF EXISTS master_content_id;
-- ALTER TABLE plan_groups DROP COLUMN IF EXISTS start_range;
-- ALTER TABLE plan_groups DROP COLUMN IF EXISTS end_range;
-- ALTER TABLE plan_groups DROP COLUMN IF EXISTS start_detail_id;
-- ALTER TABLE plan_groups DROP COLUMN IF EXISTS end_detail_id;
-- ALTER TABLE plan_groups DROP COLUMN IF EXISTS is_single_content;
--
-- -- 인덱스 제거
-- DROP INDEX IF EXISTS idx_planners_scheduler_options_gin;
-- DROP INDEX IF EXISTS idx_plan_groups_content_id;
-- DROP INDEX IF EXISTS idx_plan_groups_is_single_content;
-- DROP INDEX IF EXISTS idx_plan_groups_planner_single_content;
--
-- COMMIT;
