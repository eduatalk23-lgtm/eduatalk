-- Migration: Create tenants table
-- Description: 멀티테넌트 구조를 위한 기관(tenant) 테이블 생성
-- Date: 2025-01-07

-- ============================================
-- 1. 기관(tenant) 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'academy' CHECK (type IN ('academy', 'school', 'enterprise', 'other')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_tenants_name ON tenants(name);
CREATE INDEX IF NOT EXISTS idx_tenants_type ON tenants(type);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_tenants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER trigger_update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_tenants_updated_at();

-- RLS 설정
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자는 tenants 목록 조회 가능 (기관 선택용)
-- 주의: tenant_id 컬럼이 추가된 후 20250107000004에서 Super Admin 체크가 추가됩니다
DROP POLICY IF EXISTS "Authenticated users can view tenants" ON tenants;
CREATE POLICY "Authenticated users can view tenants"
  ON tenants
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 임시 정책: 모든 admin은 tenant 생성/수정/삭제 가능
-- tenant_id 추가 후 20250107000004에서 Super Admin만 가능하도록 업데이트됩니다
DROP POLICY IF EXISTS "Admins can insert tenants" ON tenants;
CREATE POLICY "Admins can insert tenants"
  ON tenants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update tenants" ON tenants;
CREATE POLICY "Admins can update tenants"
  ON tenants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete tenants" ON tenants;
CREATE POLICY "Admins can delete tenants"
  ON tenants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role = 'admin'
    )
  );

-- ============================================
-- 2. 코멘트 추가 (문서화)
-- ============================================

COMMENT ON TABLE tenants IS '멀티테넌트 구조를 위한 기관(학원/학교/기업) 정보 테이블';
COMMENT ON COLUMN tenants.id IS '기관 고유 ID';
COMMENT ON COLUMN tenants.name IS '기관명';
COMMENT ON COLUMN tenants.type IS '기관 유형: academy(학원), school(학교), enterprise(기업), other(기타)';

