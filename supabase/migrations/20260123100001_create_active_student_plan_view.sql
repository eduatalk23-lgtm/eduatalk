-- Migration: Create active_student_plan view for soft delete support
-- This view filters out soft-deleted records automatically

BEGIN;

-- 1. active_student_plan 뷰 생성
-- 삭제되지 않은 플랜만 조회하는 뷰
CREATE OR REPLACE VIEW active_student_plan AS
SELECT *
FROM student_plan
WHERE deleted_at IS NULL;

-- 뷰에 대한 코멘트 추가
COMMENT ON VIEW active_student_plan IS
'소프트 삭제되지 않은 활성 플랜만 조회하는 뷰. deleted_at IS NULL 조건이 자동 적용됨.';

-- 2. RLS 정책 (뷰는 기본 테이블의 RLS를 상속받음)
-- 추가 정책이 필요한 경우 여기에 작성

-- 3. 삭제된 플랜 조회용 뷰 (관리자용)
CREATE OR REPLACE VIEW deleted_student_plan AS
SELECT *
FROM student_plan
WHERE deleted_at IS NOT NULL;

COMMENT ON VIEW deleted_student_plan IS
'소프트 삭제된 플랜만 조회하는 뷰. 관리자 복구 기능에서 사용.';

COMMIT;
