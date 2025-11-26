-- ============================================
-- Supabase 마이그레이션 히스토리 리셋 SQL
-- 생성일: 2025-11-23 21:48:31
-- 
-- 주의사항:
-- 1. 이 SQL은 프로덕션 데이터베이스에서 실행하기 전에 반드시 백업을 수행하세요
-- 2. 이 작업은 마이그레이션 히스토리만 삭제하며, 실제 데이터는 보존됩니다
-- 3. 실행 후 새로운 마이그레이션을 적용할 수 있습니다
-- 
-- 실행 방법:
-- Supabase Dashboard > SQL Editor에서 이 파일의 내용을 실행하세요
-- ============================================

-- 기존 마이그레이션 히스토리 삭제
DELETE FROM supabase_migrations.schema_migrations;

-- 새로운 초기 마이그레이션으로 등록
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20250131000000', 'initial_schema', ARRAY[]::text[]);

-- 확인 쿼리
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC;














