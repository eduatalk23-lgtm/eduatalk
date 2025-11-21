wj-- Migration: Mark manually applied migrations as applied
-- Description: Supabase SQL Editor에서 수동으로 실행한 마이그레이션을 적용된 것으로 표시
-- Date: 2025-01-10
-- 
-- 주의: 이 파일은 실제 마이그레이션이 아니라, 이미 적용된 마이그레이션을 
-- Supabase 마이그레이션 시스템에 등록하기 위한 것입니다.
-- 이 파일 자체는 실행하지 마세요. 아래 SQL을 Supabase SQL Editor에서 직접 실행하세요.

-- ============================================
-- 아래 SQL을 Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. supabase_migrations.schema_migrations 테이블 확인
-- SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;

-- 2. 마이그레이션 파일의 해시 값 생성 (선택사항)
-- 실제로는 파일 내용의 해시를 사용하지만, 간단하게 파일명 기반으로도 가능

-- 3. 마이그레이션을 적용된 것으로 표시
-- 주의: 이미 존재하는 경우 에러가 발생할 수 있으므로, 먼저 확인 후 실행하세요

-- 방법 1: INSERT (존재하지 않는 경우만)
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES 
  ('20250110000000', 'create_block_sets'),
  ('20250110000001', 'add_block_sets_trigger')
ON CONFLICT (version) DO NOTHING;

-- 방법 2: 해시 값이 필요한 경우 (Supabase CLI가 생성한 해시 사용)
-- INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
-- VALUES 
--   ('20250110000000', 'create_block_sets', ARRAY[]::text[]),
--   ('20250110000001', 'add_block_sets_trigger', ARRAY[]::text[])
-- ON CONFLICT (version) DO NOTHING;

-- 4. 적용 확인
-- SELECT * FROM supabase_migrations.schema_migrations WHERE version IN ('20250110000000', '20250110000001');

