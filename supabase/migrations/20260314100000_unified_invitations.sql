-- ============================================================================
-- 통합 초대 시스템 마이그레이션
--
-- 기존 2개 테이블(team_invitations, invite_codes)을 1개로 통합
-- 모든 역할(admin, consultant, student, parent) 통합 관리
-- 발송 방식(이메일, SMS, 카카오, QR, 수동) 통합 지원
-- ============================================================================

-- ========== PHASE A: 통합 invitations 테이블 생성 ==========

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 역할 (4종 통합)
  target_role text NOT NULL CHECK (target_role IN ('admin', 'consultant', 'student', 'parent')),

  -- 대상 식별 (역할에 따라 선택적 사용)
  email text,                                          -- admin/consultant: 필수, student/parent: 선택
  phone text,                                          -- SMS/카카오 발송용
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,  -- student/parent: 필수
  relation text CHECK (relation IN ('father', 'mother', 'guardian', NULL)), -- parent: 관계

  -- 레거시 호환용 코드 (INV-XXXX-XXXX)
  legacy_code text,

  -- 상태 관리
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,

  -- 발송 관리
  delivery_method text NOT NULL DEFAULT 'manual' CHECK (delivery_method IN ('email', 'sms', 'kakao', 'qr', 'manual')),
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'skipped')),
  delivered_at timestamptz,

  -- 추적
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== PHASE B: 인덱스 생성 ==========

-- 토큰으로 초대 조회 (초대 수락 시) — 핵심 인덱스
CREATE UNIQUE INDEX idx_invitations_token ON invitations(token);

-- 레거시 코드 호환 인덱스
CREATE UNIQUE INDEX idx_invitations_legacy_code ON invitations(legacy_code) WHERE legacy_code IS NOT NULL;

-- 테넌트별 대기 중인 초대 조회
CREATE INDEX idx_invitations_tenant_status ON invitations(tenant_id, status) WHERE status = 'pending';

-- 이메일로 중복 초대 확인
CREATE INDEX idx_invitations_email_status ON invitations(email, status) WHERE status = 'pending' AND email IS NOT NULL;

-- 학생별 초대 조회
CREATE INDEX idx_invitations_student_id ON invitations(student_id) WHERE student_id IS NOT NULL;

-- 만료 초대 정리용
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at) WHERE status = 'pending';

-- ========== PHASE C: 트리거 ==========

CREATE OR REPLACE FUNCTION update_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE TRIGGER trigger_invitations_updated_at
  BEFORE UPDATE ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_invitations_updated_at();

-- ========== PHASE D: RLS ==========

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- 관리자/슈퍼어드민: 자기 테넌트 초대 전체 관리
CREATE POLICY invitations_admin_select ON invitations
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
        AND au.role IN ('admin', 'superadmin', 'consultant')
    )
  );

CREATE POLICY invitations_admin_insert ON invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
        AND au.role IN ('admin', 'superadmin', 'consultant')
    )
    AND invited_by = auth.uid()
  );

CREATE POLICY invitations_admin_update ON invitations
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
        AND au.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY invitations_admin_delete ON invitations
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
        AND au.role IN ('admin', 'superadmin')
    )
  );

-- 슈퍼어드민: 전체 관리
CREATE POLICY invitations_superadmin_all ON invitations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
        AND au.role = 'superadmin'
    )
  );

-- 인증된 사용자: 코드로 조회 (가입 시 코드 검증용)
CREATE POLICY invitations_select_by_code ON invitations
  FOR SELECT TO authenticated
  USING (true);

-- ========== PHASE E: 기존 데이터 마이그레이션 ==========

-- E-1. team_invitations → invitations
INSERT INTO invitations (
  id, token, tenant_id, target_role, email,
  status, expires_at, delivery_method, delivery_status, delivered_at,
  invited_by, accepted_at, accepted_by, created_at, updated_at
)
SELECT
  id, token, tenant_id, role, email,
  status, expires_at,
  'email',  -- team_invitations는 항상 이메일 발송
  CASE WHEN status = 'pending' THEN 'sent' ELSE 'sent' END,
  created_at,  -- delivered_at은 created_at으로 추정
  invited_by, accepted_at, accepted_by, created_at, updated_at
FROM team_invitations
ON CONFLICT (token) DO NOTHING;

-- E-2. invite_codes → invitations
INSERT INTO invitations (
  id, token, tenant_id, target_role, student_id, relation, legacy_code,
  status, expires_at, delivery_method, delivery_status,
  invited_by, accepted_at, accepted_by, created_at, updated_at
)
SELECT
  id,
  gen_random_uuid(),  -- invite_codes에는 token이 없으므로 새로 생성
  tenant_id,
  target_role,
  student_id,
  relation,
  code,  -- legacy_code에 INV-XXXX-XXXX 보존
  CASE
    WHEN used_at IS NOT NULL THEN 'accepted'
    WHEN expires_at < now() THEN 'expired'
    ELSE 'pending'
  END,
  expires_at,
  'manual',  -- invite_codes는 수동 공유
  CASE WHEN used_at IS NOT NULL THEN 'skipped' ELSE 'skipped' END,
  created_by,
  used_at,      -- accepted_at = used_at
  used_by,      -- accepted_by = used_by
  created_at,
  created_at    -- updated_at은 created_at으로
FROM invite_codes
WHERE tenant_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ========== PHASE F: 만료 초대 자동 업데이트 함수 ==========

CREATE OR REPLACE FUNCTION expire_old_invitations_unified()
RETURNS void AS $$
BEGIN
  UPDATE public.invitations
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND expires_at < now();
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ========== PHASE G: 코멘트 ==========

COMMENT ON TABLE invitations IS '통합 초대 관리 테이블 (팀/학생/학부모 초대 통합)';
COMMENT ON COLUMN invitations.token IS '초대 링크에 사용되는 고유 UUID 토큰 (/join/{token})';
COMMENT ON COLUMN invitations.target_role IS '초대 대상 역할: admin, consultant, student, parent';
COMMENT ON COLUMN invitations.legacy_code IS '레거시 초대 코드 (INV-XXXX-XXXX), 하위호환용';
COMMENT ON COLUMN invitations.delivery_method IS '발송 방식: email, sms, kakao, qr, manual';
COMMENT ON COLUMN invitations.student_id IS 'student/parent 초대 시 연결할 학생 ID';
COMMENT ON COLUMN invitations.relation IS 'parent 초대 시 관계: father, mother, guardian';
