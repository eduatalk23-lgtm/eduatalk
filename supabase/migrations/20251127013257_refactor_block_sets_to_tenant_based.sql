-- Migration: Refactor Block Sets to Tenant Based
-- Description: template_block_sets를 tenant_block_sets로 변경하고 template_id 컬럼 제거
-- Date: 2025-11-27

-- ============================================
-- 1. 기존 제약조건 및 인덱스 제거
-- ============================================

-- template_block_sets 테이블의 제약조건 제거
ALTER TABLE template_block_sets 
DROP CONSTRAINT IF EXISTS template_block_sets_template_id_fkey;

ALTER TABLE template_block_sets 
DROP CONSTRAINT IF EXISTS template_block_sets_template_id_name_key;

-- 인덱스 제거
DROP INDEX IF EXISTS idx_template_block_sets_template_id;
DROP INDEX IF EXISTS idx_template_block_sets_template_name_unique;
DROP INDEX IF EXISTS idx_template_block_sets_tenant_name_unique;

-- 트리거 제거
DROP TRIGGER IF EXISTS trigger_update_template_block_sets_updated_at ON template_block_sets;

-- ============================================
-- 2. template_blocks 테이블의 외래 키 제거
-- ============================================

ALTER TABLE template_blocks
DROP CONSTRAINT IF EXISTS template_blocks_template_block_set_id_fkey;

-- 인덱스 제거
DROP INDEX IF EXISTS idx_template_blocks_set_id;
DROP INDEX IF EXISTS idx_template_blocks_day_of_week;

-- ============================================
-- 3. template_id 컬럼 제거
-- ============================================

ALTER TABLE template_block_sets 
DROP COLUMN IF EXISTS template_id;

-- ============================================
-- 4. 테이블 이름 변경
-- ============================================

-- template_block_sets → tenant_block_sets
ALTER TABLE template_block_sets RENAME TO tenant_block_sets;

-- template_blocks → tenant_blocks
ALTER TABLE template_blocks RENAME TO tenant_blocks;

-- ============================================
-- 5. 컬럼명 변경
-- ============================================

-- template_block_set_id → tenant_block_set_id
ALTER TABLE tenant_blocks 
RENAME COLUMN template_block_set_id TO tenant_block_set_id;

-- ============================================
-- 6. 외래 키 재생성
-- ============================================

-- tenant_blocks의 외래 키
ALTER TABLE tenant_blocks
ADD CONSTRAINT tenant_blocks_tenant_block_set_id_fkey
FOREIGN KEY (tenant_block_set_id) REFERENCES tenant_block_sets(id) ON DELETE CASCADE;

-- ============================================
-- 7. UNIQUE 제약조건 재생성
-- ============================================

-- tenant_block_sets: (tenant_id, name) 고유
ALTER TABLE tenant_block_sets
ADD CONSTRAINT tenant_block_sets_tenant_id_name_unique UNIQUE(tenant_id, name);

-- tenant_blocks: (tenant_block_set_id, day_of_week, start_time, end_time) 고유
ALTER TABLE tenant_blocks
ADD CONSTRAINT tenant_blocks_set_day_time_unique UNIQUE(tenant_block_set_id, day_of_week, start_time, end_time);

-- ============================================
-- 8. 인덱스 재생성
-- ============================================

-- tenant_block_sets 인덱스
CREATE INDEX IF NOT EXISTS idx_tenant_block_sets_tenant_id ON tenant_block_sets(tenant_id);

-- tenant_blocks 인덱스
CREATE INDEX IF NOT EXISTS idx_tenant_blocks_set_id ON tenant_blocks(tenant_block_set_id);
CREATE INDEX IF NOT EXISTS idx_tenant_blocks_day_of_week ON tenant_blocks(tenant_block_set_id, day_of_week);

-- ============================================
-- 9. 트리거 재생성
-- ============================================

-- updated_at 자동 업데이트 트리거 함수 (이미 존재할 수 있음)
CREATE OR REPLACE FUNCTION update_tenant_block_sets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER trigger_update_tenant_block_sets_updated_at
  BEFORE UPDATE ON tenant_block_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_block_sets_updated_at();

-- ============================================
-- 10. 코멘트 업데이트
-- ============================================

COMMENT ON TABLE tenant_block_sets IS '테넌트별 블록 세트 테이블 (템플릿과 독립적으로 관리)';
COMMENT ON TABLE tenant_blocks IS '테넌트 블록 테이블 (요일별 시간 블록)';

