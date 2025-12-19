-- ============================================
-- Migration: camp_invitations 테이블 INSERT RLS 정책 추가
-- Date: 2025-02-02
-- Purpose: 관리자/컨설턴트가 캠프 초대를 생성할 수 있도록 허용
-- Related: app/(admin)/actions/campTemplateActions.ts::sendCampInvitationsAction
-- ============================================

-- ============================================
-- Policy: camp_invitations_insert_for_admin
-- Purpose: 관리자/컨설턴트가 자신의 테넌트에 속한 캠프 초대를 생성할 수 있도록 허용
-- Security: 
--   - 관리자/컨설턴트만 INSERT 가능
--   - 자신의 테넌트(tenant_id)에 속한 초대만 생성 가능
--   - 템플릿이 자신의 테넌트에 속해야 함
-- Related: app/(admin)/actions/campTemplateActions.ts::sendCampInvitationsAction
-- ============================================
DROP POLICY IF EXISTS "camp_invitations_insert_for_admin" ON camp_invitations;

CREATE POLICY "camp_invitations_insert_for_admin"
ON camp_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  -- 관리자/컨설턴트만 INSERT 가능
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
  -- 자신의 테넌트에 속한 초대만 생성 가능
  AND (
    -- 관리자의 테넌트와 일치해야 함
    tenant_id IN (
      SELECT tenant_id FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id IS NOT NULL
    )
    -- 또는 Super Admin인 경우 (tenant_id가 NULL)
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.role = 'superadmin'
    )
  )
  -- 템플릿이 자신의 테넌트에 속해야 함 (INSERT 시점의 camp_template_id 값 검증)
  AND EXISTS (
    SELECT 1 FROM camp_templates
    WHERE camp_templates.id = camp_invitations.camp_template_id
      AND (
        -- 일반 관리자/컨설턴트: 템플릿의 테넌트가 자신의 테넌트와 일치해야 함
        camp_templates.tenant_id IN (
          SELECT tenant_id FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.tenant_id IS NOT NULL
        )
        -- Super Admin: 모든 템플릿에 접근 가능
        OR EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.role = 'superadmin'
        )
      )
  )
);

