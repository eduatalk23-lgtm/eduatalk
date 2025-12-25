-- =============================================
-- Add Missing Admin RLS Policies
-- =============================================
-- P0-2: 관리자 테이블에 누락된 RLS 정책 추가
-- 영향받는 테이블:
--   - camp_templates: INSERT, UPDATE, DELETE 추가
--   - camp_invitations: DELETE 추가
--   - tenant_block_sets: INSERT, UPDATE, DELETE 추가
--   - tenant_blocks: INSERT, UPDATE, DELETE 추가

-- =============================================
-- 1. Helper Function: is_admin_or_consultant
-- =============================================
CREATE OR REPLACE FUNCTION is_admin_or_consultant()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
    AND role IN ('admin', 'consultant', 'superadmin')
  );
END;
$$;

-- =============================================
-- 2. camp_templates Policies
-- =============================================

-- INSERT: Admin/Consultant can create camp templates in their tenant
CREATE POLICY "camp_templates_insert_for_admin"
  ON camp_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_or_consultant()
    AND (
      is_super_admin()
      OR tenant_id = get_user_tenant_id()
    )
  );

-- UPDATE: Admin/Consultant can update camp templates in their tenant
CREATE POLICY "camp_templates_update_for_admin"
  ON camp_templates
  FOR UPDATE
  TO authenticated
  USING (
    is_admin_or_consultant()
    AND (
      is_super_admin()
      OR tenant_id = get_user_tenant_id()
    )
  )
  WITH CHECK (
    is_admin_or_consultant()
    AND (
      is_super_admin()
      OR tenant_id = get_user_tenant_id()
    )
  );

-- DELETE: Admin/Consultant can delete camp templates in their tenant
CREATE POLICY "camp_templates_delete_for_admin"
  ON camp_templates
  FOR DELETE
  TO authenticated
  USING (
    is_admin_or_consultant()
    AND (
      is_super_admin()
      OR tenant_id = get_user_tenant_id()
    )
  );

-- =============================================
-- 3. camp_invitations DELETE Policy
-- =============================================

-- DELETE: Admin can delete camp invitations in their tenant
CREATE POLICY "camp_invitations_delete_for_admin"
  ON camp_invitations
  FOR DELETE
  TO authenticated
  USING (
    is_admin_or_consultant()
    AND (
      is_super_admin()
      OR tenant_id = get_user_tenant_id()
    )
  );

-- =============================================
-- 4. tenant_block_sets Policies
-- =============================================

-- INSERT: Admin/Consultant can create block sets in their tenant
CREATE POLICY "tenant_block_sets_insert_for_admin"
  ON tenant_block_sets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_or_consultant()
    AND (
      is_super_admin()
      OR tenant_id = get_user_tenant_id()
    )
  );

-- UPDATE: Admin/Consultant can update block sets in their tenant
CREATE POLICY "tenant_block_sets_update_for_admin"
  ON tenant_block_sets
  FOR UPDATE
  TO authenticated
  USING (
    is_admin_or_consultant()
    AND (
      is_super_admin()
      OR tenant_id = get_user_tenant_id()
    )
  )
  WITH CHECK (
    is_admin_or_consultant()
    AND (
      is_super_admin()
      OR tenant_id = get_user_tenant_id()
    )
  );

-- DELETE: Admin/Consultant can delete block sets in their tenant
CREATE POLICY "tenant_block_sets_delete_for_admin"
  ON tenant_block_sets
  FOR DELETE
  TO authenticated
  USING (
    is_admin_or_consultant()
    AND (
      is_super_admin()
      OR tenant_id = get_user_tenant_id()
    )
  );

-- =============================================
-- 5. tenant_blocks Policies (via tenant_block_sets)
-- =============================================

-- INSERT: Admin/Consultant can create blocks for their tenant's block sets
CREATE POLICY "tenant_blocks_insert_for_admin"
  ON tenant_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_or_consultant()
    AND EXISTS (
      SELECT 1 FROM tenant_block_sets tbs
      WHERE tbs.id = tenant_blocks.tenant_block_set_id
      AND (
        is_super_admin()
        OR tbs.tenant_id = get_user_tenant_id()
      )
    )
  );

-- UPDATE: Admin/Consultant can update blocks for their tenant's block sets
CREATE POLICY "tenant_blocks_update_for_admin"
  ON tenant_blocks
  FOR UPDATE
  TO authenticated
  USING (
    is_admin_or_consultant()
    AND EXISTS (
      SELECT 1 FROM tenant_block_sets tbs
      WHERE tbs.id = tenant_blocks.tenant_block_set_id
      AND (
        is_super_admin()
        OR tbs.tenant_id = get_user_tenant_id()
      )
    )
  )
  WITH CHECK (
    is_admin_or_consultant()
    AND EXISTS (
      SELECT 1 FROM tenant_block_sets tbs
      WHERE tbs.id = tenant_blocks.tenant_block_set_id
      AND (
        is_super_admin()
        OR tbs.tenant_id = get_user_tenant_id()
      )
    )
  );

-- DELETE: Admin/Consultant can delete blocks for their tenant's block sets
CREATE POLICY "tenant_blocks_delete_for_admin"
  ON tenant_blocks
  FOR DELETE
  TO authenticated
  USING (
    is_admin_or_consultant()
    AND EXISTS (
      SELECT 1 FROM tenant_block_sets tbs
      WHERE tbs.id = tenant_blocks.tenant_block_set_id
      AND (
        is_super_admin()
        OR tbs.tenant_id = get_user_tenant_id()
      )
    )
  );

-- =============================================
-- Comment
-- =============================================
COMMENT ON FUNCTION is_admin_or_consultant IS 'Check if current user is an admin, consultant, or superadmin';
