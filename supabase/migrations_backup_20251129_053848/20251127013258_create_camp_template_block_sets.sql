-- Migration: Create Camp Template Block Sets Link Table
-- Description: 템플릿-블록세트 연결 테이블 생성 (1:N 관계: 블록 세트 1개 → 템플릿 여러 개)
-- Date: 2025-11-27

-- ============================================
-- 1. 템플릿-블록세트 연결 테이블 생성
-- ============================================

CREATE TABLE camp_template_block_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_template_id uuid NOT NULL UNIQUE REFERENCES camp_templates(id) ON DELETE CASCADE,
  tenant_block_set_id uuid NOT NULL REFERENCES tenant_block_sets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 2. 인덱스 생성
-- ============================================

-- 블록 세트 기준 조회 최적화 (1:N 관계에서 N 방향 조회)
CREATE INDEX idx_camp_template_block_sets_block_set_id ON camp_template_block_sets(tenant_block_set_id);

-- 템플릿 기준 조회 최적화 (이미 UNIQUE 제약조건으로 인덱스가 생성되지만 명시적으로 추가)
CREATE INDEX idx_camp_template_block_sets_template_id ON camp_template_block_sets(camp_template_id);

-- ============================================
-- 3. 코멘트 추가
-- ============================================

COMMENT ON TABLE camp_template_block_sets IS '템플릿-블록세트 연결 테이블 (1:N 관계: 블록 세트 1개 → 템플릿 여러 개)';
COMMENT ON COLUMN camp_template_block_sets.camp_template_id IS '캠프 템플릿 ID (UNIQUE: 하나의 템플릿은 하나의 블록 세트만)';
COMMENT ON COLUMN camp_template_block_sets.tenant_block_set_id IS '테넌트 블록 세트 ID (하나의 블록 세트는 여러 템플릿에서 사용 가능)';

