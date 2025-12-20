-- ============================================
-- 레거시 테이블 삭제 마이그레이션
-- ============================================
-- 
-- Phase 5 작업: student_school_scores 테이블 삭제
-- 
-- ⚠️ 주의: 이 마이그레이션은 실제로 실행하기 전에 다음을 확인해야 합니다:
-- 1. 모든 데이터가 student_internal_scores로 마이그레이션되었는지 확인
-- 2. 백업이 완료되었는지 확인
-- 3. 애플리케이션 코드에서 student_school_scores 참조가 완전히 제거되었는지 확인
--
-- 실행 전 확인 사항:
-- - /admin/migration-status 페이지에서 데이터 일치 확인
-- - 코드베이스에서 student_school_scores 참조 검색
-- - 프로덕션 환경에서는 백업 테이블로 이름 변경 권장
--
-- ============================================

-- 옵션 1: 백업 테이블로 이름 변경 (권장 - 프로덕션)
-- ALTER TABLE student_school_scores 
-- RENAME TO student_school_scores_backup_20250205;

-- 옵션 2: 테이블 완전 삭제 (개발 환경 또는 백업 완료 후)
-- DROP TABLE IF EXISTS student_school_scores CASCADE;

-- ============================================
-- 실제 삭제는 위의 주석을 해제하고 실행하세요.
-- 프로덕션 환경에서는 백업 테이블로 이름 변경을 권장합니다.
-- ============================================

-- 참고: RLS 정책도 함께 삭제되어야 할 수 있습니다.
-- DROP POLICY IF EXISTS "student_school_scores_select_policy" ON student_school_scores;
-- DROP POLICY IF EXISTS "student_school_scores_insert_policy" ON student_school_scores;
-- DROP POLICY IF EXISTS "student_school_scores_update_policy" ON student_school_scores;
-- DROP POLICY IF EXISTS "student_school_scores_delete_policy" ON student_school_scores;

