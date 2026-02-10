-- ============================================================================
-- 프로그램 마스터 테이블
--
-- PRO, PRE, 체험, 진로I, 진로II, 수시, MAS, 생기부진단 등
-- CRM 세일즈 파이프라인에서 문의 프로그램 지정 및 학생 등록 프로그램 관리
-- ============================================================================

-- 1. programs 테이블 생성
CREATE TABLE IF NOT EXISTS programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code varchar(50) NOT NULL,
  name varchar(200) NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- ============================================================================
-- 인덱스 생성
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_programs_tenant_id
  ON programs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_programs_is_active
  ON programs(tenant_id, is_active)
  WHERE is_active = true;

-- ============================================================================
-- updated_at 자동 갱신 트리거
-- ============================================================================

CREATE OR REPLACE FUNCTION update_programs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS trigger_programs_updated_at ON programs;
CREATE TRIGGER trigger_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW
  EXECUTE FUNCTION update_programs_updated_at();

-- ============================================================================
-- RLS 활성화 및 정책
-- ============================================================================

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

-- 관리자/컨설턴트: 자기 테넌트의 프로그램 조회
CREATE POLICY "Admins can view own tenant programs"
  ON programs FOR SELECT
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트에 프로그램 생성
CREATE POLICY "Admins can create programs in own tenant"
  ON programs FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트의 프로그램 수정
CREATE POLICY "Admins can update own tenant programs"
  ON programs FOR UPDATE
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트의 프로그램 삭제
CREATE POLICY "Admins can delete own tenant programs"
  ON programs FOR DELETE
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- ============================================================================
-- 테이블 코멘트
-- ============================================================================

COMMENT ON TABLE programs IS '프로그램 마스터 테이블 - PRO, PRE, 체험, 진로 등 교육 프로그램 정의';
COMMENT ON COLUMN programs.code IS '프로그램 코드 (PRO, PRE, TRIAL 등) - 테넌트 내 유니크';
COMMENT ON COLUMN programs.name IS '프로그램 표시 이름';
COMMENT ON COLUMN programs.description IS '프로그램 설명';
COMMENT ON COLUMN programs.is_active IS '활성 여부 (비활성 프로그램은 새 등록 불가)';
COMMENT ON COLUMN programs.display_order IS '표시 순서';
