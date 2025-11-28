-- Migration: Add Template Block Sets
-- Description: 템플릿 전용 블록 세트 및 블록 테이블 추가
-- Date: 2025-02-02

-- ============================================
-- 1. 템플릿 블록 세트 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS template_block_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES camp_templates(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, name)
);

COMMENT ON TABLE template_block_sets IS '템플릿 전용 블록 세트 테이블';

-- ============================================
-- 2. 템플릿 블록 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS template_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_block_set_id uuid NOT NULL REFERENCES template_block_sets(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL CHECK (end_time > start_time),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_block_set_id, day_of_week, start_time, end_time)
);

COMMENT ON TABLE template_blocks IS '템플릿 블록 테이블 (요일별 시간 블록)';

-- ============================================
-- 3. 인덱스 생성
-- ============================================
CREATE INDEX IF NOT EXISTS idx_template_block_sets_template_id ON template_block_sets(template_id);
CREATE INDEX IF NOT EXISTS idx_template_block_sets_tenant_id ON template_block_sets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_template_blocks_set_id ON template_blocks(template_block_set_id);
CREATE INDEX IF NOT EXISTS idx_template_blocks_day_of_week ON template_blocks(template_block_set_id, day_of_week);

-- ============================================
-- 4. updated_at 자동 업데이트 트리거 함수
-- ============================================
CREATE OR REPLACE FUNCTION update_template_block_sets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_template_block_sets_updated_at ON template_block_sets;
CREATE TRIGGER trigger_update_template_block_sets_updated_at
  BEFORE UPDATE ON template_block_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_template_block_sets_updated_at();

