-- ============================================
-- Migration: camp_invitations 테이블 UPDATE 및 SELECT RLS 정책 추가
-- Date: 2025-12-22
-- Purpose: 학생이 자신의 초대 상태를 업데이트하고, 관리자가 초대 목록을 조회할 수 있도록 허용
-- Related: 
--   - app/(student)/actions/campActions.ts::submitCampParticipation
--   - lib/data/campTemplates.ts::updateCampInvitationStatus
--   - lib/data/campParticipants.ts::loadCampParticipants
-- ============================================

-- ============================================
-- 1. RLS 활성화 확인 및 활성화
-- ============================================
ALTER TABLE camp_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Policy: camp_invitations_update_for_student
-- Purpose: 학생이 자신의 초대 상태를 업데이트할 수 있도록 허용
-- Security:
--   - 학생만 UPDATE 가능 (students 테이블에 존재)
--   - 자신의 초대(student_id가 자신의 ID)만 업데이트 가능
--   - pending 상태인 초대만 업데이트 가능 (이미 처리된 초대는 수정 불가)
-- ============================================
DROP POLICY IF EXISTS "camp_invitations_update_for_student" ON camp_invitations;

CREATE POLICY "camp_invitations_update_for_student"
ON camp_invitations
FOR UPDATE
TO authenticated
USING (
  -- 학생인지 확인
  EXISTS (
    SELECT 1 FROM students
    WHERE students.id = auth.uid()
  )
  -- 자신의 초대인지 확인
  AND student_id = auth.uid()
  -- pending 상태인 초대만 업데이트 가능 (이미 처리된 초대는 수정 불가)
  AND status = 'pending'
)
WITH CHECK (
  -- 학생인지 확인
  EXISTS (
    SELECT 1 FROM students
    WHERE students.id = auth.uid()
  )
  -- 자신의 초대인지 확인
  AND student_id = auth.uid()
  -- status는 'accepted' 또는 'declined'로만 변경 가능
  AND status IN ('accepted', 'declined')
);

-- ============================================
-- 3. Policy: camp_invitations_select_for_student
-- Purpose: 학생이 자신의 초대를 조회할 수 있도록 허용
-- Security:
--   - 학생만 SELECT 가능
--   - 자신의 초대만 조회 가능
-- ============================================
DROP POLICY IF EXISTS "camp_invitations_select_for_student" ON camp_invitations;

CREATE POLICY "camp_invitations_select_for_student"
ON camp_invitations
FOR SELECT
TO authenticated
USING (
  -- 학생인지 확인
  EXISTS (
    SELECT 1 FROM students
    WHERE students.id = auth.uid()
  )
  -- 자신의 초대인지 확인
  AND student_id = auth.uid()
);

-- ============================================
-- 4. Policy: camp_invitations_select_for_admin
-- Purpose: 관리자/컨설턴트가 자신의 테넌트에 속한 초대를 조회할 수 있도록 허용
-- Security:
--   - 관리자/컨설턴트만 SELECT 가능
--   - 자신의 테넌트에 속한 초대만 조회 가능
--   - Super Admin은 모든 테넌트의 초대 조회 가능
-- ============================================
DROP POLICY IF EXISTS "camp_invitations_select_for_admin" ON camp_invitations;

CREATE POLICY "camp_invitations_select_for_admin"
ON camp_invitations
FOR SELECT
TO authenticated
USING (
  -- 관리자/컨설턴트인지 확인
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
  AND (
    -- 일반 관리자/컨설턴트: 자신의 테넌트에 속한 초대만 조회 가능
    tenant_id IN (
      SELECT tenant_id FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id IS NOT NULL
    )
    -- Super Admin: 모든 테넌트의 초대 조회 가능
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.role = 'superadmin'
    )
  )
);

-- ============================================
-- 5. Policy: camp_invitations_update_for_admin
-- Purpose: 관리자/컨설턴트가 자신의 테넌트에 속한 초대를 업데이트할 수 있도록 허용
-- Security:
--   - 관리자/컨설턴트만 UPDATE 가능
--   - 자신의 테넌트에 속한 초대만 업데이트 가능
--   - Super Admin은 모든 테넌트의 초대 업데이트 가능
-- ============================================
DROP POLICY IF EXISTS "camp_invitations_update_for_admin" ON camp_invitations;

CREATE POLICY "camp_invitations_update_for_admin"
ON camp_invitations
FOR UPDATE
TO authenticated
USING (
  -- 관리자/컨설턴트인지 확인
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
  AND (
    -- 일반 관리자/컨설턴트: 자신의 테넌트에 속한 초대만 업데이트 가능
    tenant_id IN (
      SELECT tenant_id FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id IS NOT NULL
    )
    -- Super Admin: 모든 테넌트의 초대 업데이트 가능
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.role = 'superadmin'
    )
  )
)
WITH CHECK (
  -- 관리자/컨설턴트인지 확인
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
  AND (
    -- 일반 관리자/컨설턴트: 자신의 테넌트에 속한 초대만 업데이트 가능
    tenant_id IN (
      SELECT tenant_id FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id IS NOT NULL
    )
    -- Super Admin: 모든 테넌트의 초대 업데이트 가능
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.role = 'superadmin'
    )
  )
);

