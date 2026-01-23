-- ============================================================================
-- 팀 초대 시스템 테이블 생성
--
-- 테넌트 관리자가 컨설턴트/관리자를 초대할 수 있는 시스템
-- ============================================================================

-- 1. team_invitations 테이블 생성
CREATE TABLE IF NOT EXISTS team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'consultant')),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. 인덱스 생성
-- 토큰으로 초대 조회 (초대 수락 시)
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invitations_token
  ON team_invitations(token);

-- 테넌트별 대기 중인 초대 조회
CREATE INDEX IF NOT EXISTS idx_team_invitations_tenant_status
  ON team_invitations(tenant_id, status)
  WHERE status = 'pending';

-- 이메일로 초대 조회 (중복 확인)
CREATE INDEX IF NOT EXISTS idx_team_invitations_email_status
  ON team_invitations(email, status)
  WHERE status = 'pending';

-- 만료된 초대 정리용
CREATE INDEX IF NOT EXISTS idx_team_invitations_expires_at
  ON team_invitations(expires_at)
  WHERE status = 'pending';

-- 3. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_team_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS trigger_team_invitations_updated_at ON team_invitations;
CREATE TRIGGER trigger_team_invitations_updated_at
  BEFORE UPDATE ON team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_team_invitations_updated_at();

-- 4. RLS 활성화
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책

-- 5-1. 테넌트 관리자: 자기 테넌트 초대 조회
CREATE POLICY "Tenant admins can view own tenant invitations"
  ON team_invitations FOR SELECT
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
        AND au.role IN ('admin', 'superadmin')
    )
  );

-- 5-2. 테넌트 관리자: 자기 테넌트에 초대 생성
CREATE POLICY "Tenant admins can create invitations"
  ON team_invitations FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
        AND au.role IN ('admin', 'superadmin')
    )
    AND invited_by = auth.uid()
  );

-- 5-3. 테넌트 관리자: 자기 테넌트 초대 수정 (취소 등)
CREATE POLICY "Tenant admins can update own tenant invitations"
  ON team_invitations FOR UPDATE
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
        AND au.role IN ('admin', 'superadmin')
    )
  );

-- 5-4. 슈퍼어드민: 모든 초대 조회/관리
CREATE POLICY "Superadmins can manage all invitations"
  ON team_invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
        AND au.role = 'superadmin'
    )
  );

-- 5-5. 초대받은 사용자: 자기 이메일 초대만 조회 (토큰으로 접근)
-- Note: 토큰 기반 접근은 서버 액션에서 admin client로 처리

-- 6. 만료된 초대 자동 업데이트 함수 (선택적, cron job으로 실행)
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE public.team_invitations
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND expires_at < now();
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- 7. 테이블 코멘트
COMMENT ON TABLE team_invitations IS '테넌트 팀 초대 관리 테이블';
COMMENT ON COLUMN team_invitations.token IS '초대 링크에 사용되는 고유 토큰';
COMMENT ON COLUMN team_invitations.status IS 'pending: 대기중, accepted: 수락됨, expired: 만료됨, cancelled: 취소됨';
COMMENT ON COLUMN team_invitations.role IS '초대할 역할 (admin 또는 consultant)';
