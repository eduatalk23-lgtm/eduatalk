-- Migration: Make template_id nullable in template_block_sets
-- Description: 템플릿 블록 세트의 template_id를 NULL 허용으로 변경하여 템플릿 저장 전에도 tenant_id로 블록 세트 생성 가능하도록 함
-- Date: 2025-11-26

-- ============================================
-- 1. 기존 UNIQUE 제약조건 제거
-- ============================================
ALTER TABLE template_block_sets 
DROP CONSTRAINT IF EXISTS template_block_sets_template_id_name_key;

-- ============================================
-- 2. 기존 외래 키 제약조건 제거
-- ============================================
ALTER TABLE template_block_sets 
DROP CONSTRAINT IF EXISTS template_block_sets_template_id_fkey;

-- ============================================
-- 3. template_id 컬럼을 NULL 허용으로 변경
-- ============================================
ALTER TABLE template_block_sets 
ALTER COLUMN template_id DROP NOT NULL;

-- ============================================
-- 4. 외래 키 제약조건 재생성 (ON DELETE CASCADE 유지)
-- ============================================
ALTER TABLE template_block_sets
ADD CONSTRAINT template_block_sets_template_id_fkey
FOREIGN KEY (template_id) REFERENCES camp_templates(id) ON DELETE CASCADE;

-- ============================================
-- 5. UNIQUE 제약조건 재생성 (부분 인덱스 사용)
-- - template_id가 NULL이 아닐 때: (template_id, name) 고유
-- - template_id가 NULL일 때: (tenant_id, name) 고유
-- ============================================

-- template_id가 NOT NULL인 경우의 UNIQUE 제약조건
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_block_sets_template_name_unique
ON template_block_sets(template_id, name)
WHERE template_id IS NOT NULL;

-- template_id가 NULL인 경우의 UNIQUE 제약조건 (tenant_id 기준)
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_block_sets_tenant_name_unique
ON template_block_sets(tenant_id, name)
WHERE template_id IS NULL;

COMMENT ON TABLE template_block_sets IS '템플릿 전용 블록 세트 테이블 (template_id는 NULL 허용, 템플릿 저장 전에도 tenant_id로 생성 가능)';

