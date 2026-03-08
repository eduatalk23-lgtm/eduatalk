-- ============================================================================
-- Phase 2: Unify ALL nested RLS anti-patterns with SECURITY DEFINER helpers
-- ============================================================================
-- Phase 1 (20260316100000) fixed: calendar_events, event_study_data, calendars, calendar_list
-- Phase 1 created: rls_check_admin_tenant, rls_check_parent_student,
--   rls_check_calendar_parent, rls_check_event_student, rls_check_event_admin,
--   rls_check_calendar_admin
--
-- This Phase 2 fixes ALL remaining tables (~55 tables, ~170 policies).
--
-- Existing SECURITY DEFINER functions that stay as-is:
--   is_super_admin(), is_admin_or_consultant(), get_user_tenant_id()
--
-- Strategy:
--   1. Create new SECURITY DEFINER helpers
--   2. DROP + recreate policies per table (idempotent with IF EXISTS)
--   3. Clean up duplicate policies
--   4. Add supporting indexes
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create SECURITY DEFINER helper functions
-- ============================================================================

-- 1. Admin member: any admin role + tenant match (no role filter)
-- Replaces: tenant_id IN (SELECT au.tenant_id FROM admin_users au WHERE au.id = auth.uid())
CREATE OR REPLACE FUNCTION public.rls_check_admin_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND tenant_id = p_tenant_id
  );
$$;

-- 2. Admin only (role = 'admin') + tenant match (for destructive/sensitive ops)
CREATE OR REPLACE FUNCTION public.rls_check_admin_only_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND tenant_id = p_tenant_id AND role = 'admin'
  );
$$;

-- 3. Admin full: admin/consultant/superadmin + tenant match
CREATE OR REPLACE FUNCTION public.rls_check_admin_full_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND tenant_id = p_tenant_id
      AND role IN ('admin', 'consultant', 'superadmin')
  );
$$;

-- 4. Is admin: any admin_users membership (no tenant/role filter)
CREATE OR REPLACE FUNCTION public.rls_check_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  );
$$;

-- 5. Is admin or consultant (no tenant filter)
CREATE OR REPLACE FUNCTION public.rls_check_is_admin_or_consultant()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND role IN ('admin', 'consultant')
  );
$$;

-- 6. Tenant member: any user type (admin/student/parent) + tenant match
-- Replaces get_user_tenant_id() = tenant_id pattern
CREATE OR REPLACE FUNCTION public.rls_check_tenant_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND tenant_id = p_tenant_id)
      OR EXISTS (SELECT 1 FROM public.students WHERE id = auth.uid() AND tenant_id = p_tenant_id)
      OR EXISTS (SELECT 1 FROM public.parent_users WHERE id = auth.uid() AND tenant_id = p_tenant_id);
$$;

-- 7. Student's tenant admin check (for tables with student_id but no tenant_id)
-- Joins students -> admin_users via tenant_id
CREATE OR REPLACE FUNCTION public.rls_check_student_tenant_admin(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.admin_users au ON au.tenant_id = s.tenant_id
    WHERE s.id = p_student_id
      AND au.id = auth.uid()
      AND au.role IN ('admin', 'consultant')
  );
$$;

-- 8. Is superadmin role check
CREATE OR REPLACE FUNCTION public.rls_check_is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

-- 9. Admin with specific roles + tenant match
-- For policies that require admin/superadmin (not consultant)
CREATE OR REPLACE FUNCTION public.rls_check_admin_or_superadmin_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND tenant_id = p_tenant_id
      AND role IN ('admin', 'superadmin')
  );
$$;

-- 10. File owner or admin of file's tenant
CREATE OR REPLACE FUNCTION public.rls_check_file_owner_or_admin(p_file_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.id = p_file_id
      AND (
        f.uploaded_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.admin_users au
          WHERE au.id = auth.uid() AND au.tenant_id = f.tenant_id
        )
      )
  );
$$;

-- 11. File access: owner or admin or parent of file's student
CREATE OR REPLACE FUNCTION public.rls_check_file_access(p_file_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.id = p_file_id
      AND (
        f.uploaded_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.admin_users au
          WHERE au.id = auth.uid() AND au.tenant_id = f.tenant_id
        )
        OR EXISTS (
          SELECT 1 FROM public.parent_student_links psl
          WHERE psl.parent_id = auth.uid() AND psl.student_id = f.student_id
        )
      )
  );
$$;

-- 12. Plan group access: student or admin or parent
CREATE OR REPLACE FUNCTION public.rls_check_plan_group_access(p_plan_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plan_groups pg
    WHERE pg.id = p_plan_group_id
      AND (
        pg.student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.admin_users au
          WHERE au.id = auth.uid() AND au.tenant_id = pg.tenant_id
        )
        OR EXISTS (
          SELECT 1 FROM public.parent_student_links psl
          JOIN public.parent_users pu ON pu.id = psl.parent_id
          WHERE psl.student_id = pg.student_id AND pu.id = auth.uid()
        )
      )
  );
$$;

-- 13. Camp template admin check
CREATE OR REPLACE FUNCTION public.rls_check_camp_template_admin(p_template_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.camp_templates ct
    JOIN public.admin_users au ON au.tenant_id = ct.tenant_id
    WHERE ct.id = p_template_id AND au.id = auth.uid()
  );
$$;

-- 14. Camp template tenant member check (any user in template's tenant)
CREATE OR REPLACE FUNCTION public.rls_check_camp_template_member(p_template_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.camp_templates ct
    WHERE ct.id = p_template_id
      AND (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND tenant_id = ct.tenant_id)
        OR EXISTS (SELECT 1 FROM public.students WHERE id = auth.uid() AND tenant_id = ct.tenant_id)
        OR EXISTS (SELECT 1 FROM public.parent_users WHERE id = auth.uid() AND tenant_id = ct.tenant_id)
      )
  );
$$;

-- 15. Block set admin check (tenant_block_sets -> admin_users)
CREATE OR REPLACE FUNCTION public.rls_check_block_set_admin(p_block_set_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_block_sets tbs
    JOIN public.admin_users au ON au.tenant_id = tbs.tenant_id
    WHERE tbs.id = p_block_set_id
      AND au.id = auth.uid()
      AND au.role IN ('admin', 'consultant', 'superadmin')
  );
$$;

-- 16. Block set tenant member check
CREATE OR REPLACE FUNCTION public.rls_check_block_set_member(p_block_set_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_block_sets tbs
    WHERE tbs.id = p_block_set_id
      AND (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND tenant_id = tbs.tenant_id)
        OR EXISTS (SELECT 1 FROM public.students WHERE id = auth.uid() AND tenant_id = tbs.tenant_id)
        OR EXISTS (SELECT 1 FROM public.parent_users WHERE id = auth.uid() AND tenant_id = tbs.tenant_id)
      )
  );
$$;

-- 17. Content partner admin check (content_partner_sync_logs -> content_partners -> admin_users)
CREATE OR REPLACE FUNCTION public.rls_check_partner_admin(p_partner_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.content_partners cp
    JOIN public.admin_users au ON au.tenant_id = cp.tenant_id
    WHERE cp.id = p_partner_id AND au.id = auth.uid()
  );
$$;

-- 18. Payment order parent check (payment_orders -> payment_records -> parent_student_links)
CREATE OR REPLACE FUNCTION public.rls_check_payment_order_parent(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.payment_records pr
    JOIN public.parent_student_links psl ON psl.student_id = pr.student_id
    WHERE pr.payment_order_id = p_order_id
      AND psl.parent_id = auth.uid()
  );
$$;

-- 19. Chat room admin check (chat_rooms -> admin_users via tenant_id)
CREATE OR REPLACE FUNCTION public.rls_check_chat_room_admin(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_rooms cr
    JOIN public.admin_users au ON au.tenant_id = cr.tenant_id
    WHERE cr.id = p_room_id
      AND au.id = auth.uid()
      AND au.role IN ('admin', 'consultant')
  );
$$;

-- 20. File distribution student/parent select check
CREATE OR REPLACE FUNCTION public.rls_check_file_distribution_select(p_file_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.file_distributions fd
    WHERE fd.file_id = p_file_id
      AND (
        fd.student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.parent_student_links psl
          WHERE psl.parent_id = auth.uid() AND psl.student_id = fd.student_id
        )
      )
  );
$$;

-- ============================================================================
-- STEP 2: Grant EXECUTE on all new helper functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.rls_check_admin_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_admin_only_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_admin_full_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_is_admin_or_consultant() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_tenant_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_student_tenant_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_admin_or_superadmin_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_file_owner_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_file_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_plan_group_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_camp_template_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_camp_template_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_block_set_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_block_set_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_partner_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_payment_order_parent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_chat_room_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_file_distribution_select(uuid) TO authenticated;

-- ============================================================================
-- STEP 3: Supporting indexes
-- ============================================================================

-- Admin member check (no role filter)
CREATE INDEX IF NOT EXISTS idx_admin_users_member_check
  ON admin_users (id, tenant_id);

-- Students tenant lookup (for rls_check_tenant_member, rls_check_student_tenant_admin)
CREATE INDEX IF NOT EXISTS idx_students_tenant_check
  ON students (id, tenant_id);

-- Parent users tenant lookup
CREATE INDEX IF NOT EXISTS idx_parent_users_tenant_check
  ON parent_users (id, tenant_id);

-- Parent-student links for parent checks
CREATE INDEX IF NOT EXISTS idx_parent_student_links_parent
  ON parent_student_links (parent_id, student_id);

-- Files lookup for file access checks
CREATE INDEX IF NOT EXISTS idx_files_id_tenant
  ON files (id, tenant_id, uploaded_by);

-- ============================================================================
-- STEP 4: Replace policies table by table
-- ============================================================================

-- ============================================================================
-- 4.1 admin_users
-- ============================================================================
-- Original: is_super_admin() OR get_user_tenant_id() = tenant_id OR auth.uid() = id
-- Replace get_user_tenant_id() with rls_check_tenant_member()
DROP POLICY IF EXISTS "tenant_isolation_admin_users_select" ON admin_users;
CREATE POLICY "tenant_isolation_admin_users_select" ON admin_users
  FOR SELECT
  USING (is_super_admin() OR auth.uid() = id OR public.rls_check_tenant_member(tenant_id));

-- ============================================================================
-- 4.2 attendance_qr_codes
-- ============================================================================
DROP POLICY IF EXISTS "attendance_qr_codes_select_admin" ON attendance_qr_codes;
DROP POLICY IF EXISTS "attendance_qr_codes_insert_admin" ON attendance_qr_codes;
DROP POLICY IF EXISTS "attendance_qr_codes_update_admin" ON attendance_qr_codes;
DROP POLICY IF EXISTS "attendance_qr_codes_select_student" ON attendance_qr_codes;

CREATE POLICY "attendance_qr_codes_select_admin" ON attendance_qr_codes
  FOR SELECT USING (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "attendance_qr_codes_insert_admin" ON attendance_qr_codes
  FOR INSERT WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "attendance_qr_codes_update_admin" ON attendance_qr_codes
  FOR UPDATE USING (public.rls_check_admin_tenant(tenant_id));

-- Student: can view active, non-expired QR codes in own tenant
CREATE POLICY "attendance_qr_codes_select_student" ON attendance_qr_codes
  FOR SELECT
  USING (is_active = true AND expires_at > now() AND public.rls_check_tenant_member(tenant_id));

-- ============================================================================
-- 4.3 attendance_record_history
-- ============================================================================
DROP POLICY IF EXISTS "attendance_record_history_select" ON attendance_record_history;
DROP POLICY IF EXISTS "attendance_record_history_insert" ON attendance_record_history;

CREATE POLICY "attendance_record_history_select" ON attendance_record_history
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "attendance_record_history_insert" ON attendance_record_history
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.4 attendance_records
-- ============================================================================
DROP POLICY IF EXISTS "attendance_records_select_admin" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_insert_admin" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_update_admin" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_delete_admin" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_insert_student" ON attendance_records;

CREATE POLICY "attendance_records_select_admin" ON attendance_records
  FOR SELECT USING (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "attendance_records_insert_admin" ON attendance_records
  FOR INSERT WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "attendance_records_update_admin" ON attendance_records
  FOR UPDATE USING (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "attendance_records_delete_admin" ON attendance_records
  FOR DELETE USING (public.rls_check_admin_only_tenant(tenant_id));

-- Student: can insert own records within own tenant
CREATE POLICY "attendance_records_insert_student" ON attendance_records
  FOR INSERT WITH CHECK (student_id = auth.uid() AND public.rls_check_tenant_member(tenant_id));

-- ============================================================================
-- 4.5 audit_logs
-- ============================================================================
DROP POLICY IF EXISTS "Admin can view own tenant audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Superadmin can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON audit_logs;

CREATE POLICY "Admin can view own tenant audit logs" ON audit_logs
  FOR SELECT USING (public.rls_check_admin_only_tenant(tenant_id));

CREATE POLICY "Superadmin can view all audit logs" ON audit_logs
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Admins can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (public.rls_check_is_admin());

-- ============================================================================
-- 4.6 book_details
-- ============================================================================
DROP POLICY IF EXISTS "book_details_modify_admin" ON book_details;

CREATE POLICY "book_details_modify_admin" ON book_details
  FOR ALL
  USING (public.rls_check_is_admin())
  WITH CHECK (public.rls_check_is_admin());

-- ============================================================================
-- 4.7 camp_invitations
-- ============================================================================
-- Clean up redundant student select policies
DROP POLICY IF EXISTS "Students can view own camp invitations" ON camp_invitations;
DROP POLICY IF EXISTS "camp_invitations_select_for_student" ON camp_invitations;
DROP POLICY IF EXISTS "camp_invitations_select_for_admin" ON camp_invitations;
DROP POLICY IF EXISTS "camp_invitations_insert_for_admin" ON camp_invitations;
DROP POLICY IF EXISTS "camp_invitations_update_for_admin" ON camp_invitations;
DROP POLICY IF EXISTS "camp_invitations_update_for_student" ON camp_invitations;
DROP POLICY IF EXISTS "camp_invitations_delete_for_admin" ON camp_invitations;

-- Admin: select/insert/update/delete within tenant (or superadmin)
CREATE POLICY "camp_invitations_admin_select" ON camp_invitations
  FOR SELECT USING (public.rls_check_admin_member(tenant_id) OR is_super_admin());

CREATE POLICY "camp_invitations_admin_insert" ON camp_invitations
  FOR INSERT WITH CHECK (
    (public.rls_check_admin_member(tenant_id) OR is_super_admin())
    AND public.rls_check_camp_template_admin(camp_template_id)
  );

CREATE POLICY "camp_invitations_admin_update" ON camp_invitations
  FOR UPDATE
  USING (public.rls_check_admin_member(tenant_id) OR is_super_admin())
  WITH CHECK (public.rls_check_admin_member(tenant_id) OR is_super_admin());

CREATE POLICY "camp_invitations_admin_delete" ON camp_invitations
  FOR DELETE USING (public.rls_check_admin_member(tenant_id) OR is_super_admin());

-- Student: select own invitations
CREATE POLICY "camp_invitations_student_select" ON camp_invitations
  FOR SELECT USING (student_id = auth.uid());

-- Student: update own pending invitations (accept/decline)
CREATE POLICY "camp_invitations_student_update" ON camp_invitations
  FOR UPDATE
  USING (student_id = auth.uid() AND status::text = 'pending')
  WITH CHECK (student_id = auth.uid() AND status::text IN ('accepted', 'declined'));

-- ============================================================================
-- 4.8 camp_template_block_sets
-- ============================================================================
DROP POLICY IF EXISTS "Users can view camp template block sets in their tenant" ON camp_template_block_sets;
DROP POLICY IF EXISTS "camp_template_block_sets_select_for_admin" ON camp_template_block_sets;
DROP POLICY IF EXISTS "camp_template_block_sets_insert_for_admin" ON camp_template_block_sets;
DROP POLICY IF EXISTS "camp_template_block_sets_update_for_admin" ON camp_template_block_sets;
DROP POLICY IF EXISTS "camp_template_block_sets_delete_for_admin" ON camp_template_block_sets;

-- Any tenant member can view (or superadmin)
CREATE POLICY "camp_template_block_sets_tenant_select" ON camp_template_block_sets
  FOR SELECT USING (is_super_admin() OR public.rls_check_camp_template_member(camp_template_id));

-- Admin: insert (must be admin of both template's and block_set's tenant)
CREATE POLICY "camp_template_block_sets_admin_insert" ON camp_template_block_sets
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR (public.rls_check_camp_template_admin(camp_template_id) AND public.rls_check_block_set_admin(tenant_block_set_id))
  );

-- Admin: update
CREATE POLICY "camp_template_block_sets_admin_update" ON camp_template_block_sets
  FOR UPDATE
  USING (is_super_admin() OR public.rls_check_camp_template_admin(camp_template_id))
  WITH CHECK (
    is_super_admin()
    OR (public.rls_check_camp_template_admin(camp_template_id) AND public.rls_check_block_set_admin(tenant_block_set_id))
  );

-- Admin: delete
CREATE POLICY "camp_template_block_sets_admin_delete" ON camp_template_block_sets
  FOR DELETE USING (is_super_admin() OR public.rls_check_camp_template_admin(camp_template_id));

-- ============================================================================
-- 4.9 camp_templates
-- ============================================================================
-- Original uses is_admin_or_consultant() + get_user_tenant_id() — both already SECURITY DEFINER.
-- Replace get_user_tenant_id() with rls_check_tenant_member for SELECT,
-- and use rls_check_admin_tenant for write ops.
DROP POLICY IF EXISTS "Users can view camp templates in their tenant" ON camp_templates;
DROP POLICY IF EXISTS "camp_templates_insert_for_admin" ON camp_templates;
DROP POLICY IF EXISTS "camp_templates_update_for_admin" ON camp_templates;
DROP POLICY IF EXISTS "camp_templates_delete_for_admin" ON camp_templates;

CREATE POLICY "camp_templates_tenant_select" ON camp_templates
  FOR SELECT USING (is_super_admin() OR public.rls_check_tenant_member(tenant_id));

CREATE POLICY "camp_templates_admin_insert" ON camp_templates
  FOR INSERT WITH CHECK (is_super_admin() OR public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "camp_templates_admin_update" ON camp_templates
  FOR UPDATE
  USING (is_super_admin() OR public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (is_super_admin() OR public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "camp_templates_admin_delete" ON camp_templates
  FOR DELETE USING (is_super_admin() OR public.rls_check_admin_tenant(tenant_id));

-- ============================================================================
-- 4.10 chat_messages
-- ============================================================================
DROP POLICY IF EXISTS "chat_messages_update" ON chat_messages;

CREATE POLICY "chat_messages_update" ON chat_messages
  FOR UPDATE
  USING (sender_id = auth.uid() OR public.rls_check_chat_room_admin(room_id));

-- ============================================================================
-- 4.11 chat_reports
-- ============================================================================
DROP POLICY IF EXISTS "chat_reports_select_admin" ON chat_reports;
DROP POLICY IF EXISTS "chat_reports_update_admin" ON chat_reports;

CREATE POLICY "chat_reports_select_admin" ON chat_reports
  FOR SELECT USING (public.rls_check_is_admin_or_consultant());

CREATE POLICY "chat_reports_update_admin" ON chat_reports
  FOR UPDATE USING (public.rls_check_is_admin_or_consultant());

-- ============================================================================
-- 4.12 chat_room_members
-- ============================================================================
DROP POLICY IF EXISTS "chat_room_members_select_admin" ON chat_room_members;
DROP POLICY IF EXISTS "chat_room_members_insert" ON chat_room_members;
DROP POLICY IF EXISTS "chat_room_members_update" ON chat_room_members;

CREATE POLICY "chat_room_members_select_admin" ON chat_room_members
  FOR SELECT USING (public.rls_check_is_admin_or_consultant());

CREATE POLICY "chat_room_members_insert" ON chat_room_members
  FOR INSERT WITH CHECK (user_id = auth.uid() OR public.rls_check_is_admin_or_consultant());

CREATE POLICY "chat_room_members_update" ON chat_room_members
  FOR UPDATE USING (user_id = auth.uid() OR public.rls_check_is_admin_or_consultant());

-- ============================================================================
-- 4.13 chat_rooms
-- ============================================================================
DROP POLICY IF EXISTS "chat_rooms_select_admin" ON chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_update" ON chat_rooms;

CREATE POLICY "chat_rooms_select_admin" ON chat_rooms
  FOR SELECT USING (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "chat_rooms_update" ON chat_rooms
  FOR UPDATE USING (created_by = auth.uid() OR public.rls_check_admin_tenant(tenant_id));

-- ============================================================================
-- 4.14 consultant_assignments
-- ============================================================================
DROP POLICY IF EXISTS "ca_select_policy" ON consultant_assignments;
DROP POLICY IF EXISTS "ca_insert_policy" ON consultant_assignments;
DROP POLICY IF EXISTS "ca_update_policy" ON consultant_assignments;
DROP POLICY IF EXISTS "ca_delete_policy" ON consultant_assignments;

CREATE POLICY "ca_select_policy" ON consultant_assignments
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "ca_insert_policy" ON consultant_assignments
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "ca_update_policy" ON consultant_assignments
  FOR UPDATE USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "ca_delete_policy" ON consultant_assignments
  FOR DELETE USING (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.15 consultation_schedules
-- ============================================================================
-- Original: tenant_id = get_user_tenant_id() — get_user_tenant_id is already sec definer
-- but replace with direct function for consistency
DROP POLICY IF EXISTS "tenant_isolation" ON consultation_schedules;

CREATE POLICY "tenant_isolation" ON consultation_schedules
  FOR ALL
  USING (public.rls_check_tenant_member(tenant_id))
  WITH CHECK (public.rls_check_tenant_member(tenant_id));

-- ============================================================================
-- 4.16 content_ai_extraction_logs
-- ============================================================================
DROP POLICY IF EXISTS "Admin tenant isolation for content_ai_extraction_logs" ON content_ai_extraction_logs;

CREATE POLICY "content_ai_extraction_logs_admin_all" ON content_ai_extraction_logs
  FOR ALL
  USING (public.rls_check_admin_member(tenant_id))
  WITH CHECK (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.17 content_analysis_queue
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage analysis queue" ON content_analysis_queue;
DROP POLICY IF EXISTS "Admins can view their tenant queue" ON content_analysis_queue;

-- Super admin / admin role can manage all
CREATE POLICY "content_analysis_queue_admin_manage" ON content_analysis_queue
  FOR ALL
  USING (is_super_admin() OR public.rls_check_admin_only_tenant(tenant_id))
  WITH CHECK (is_super_admin() OR public.rls_check_admin_only_tenant(tenant_id));

-- Any admin member can view own tenant
CREATE POLICY "content_analysis_queue_tenant_select" ON content_analysis_queue
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.18 content_concept_mappings
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage mappings" ON content_concept_mappings;

CREATE POLICY "content_concept_mappings_admin" ON content_concept_mappings
  FOR ALL
  USING (is_super_admin() OR public.rls_check_is_admin())
  WITH CHECK (is_super_admin() OR public.rls_check_is_admin());

-- ============================================================================
-- 4.19 content_concepts
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage concepts" ON content_concepts;

CREATE POLICY "content_concepts_admin" ON content_concepts
  FOR ALL
  USING (is_super_admin() OR public.rls_check_is_admin())
  WITH CHECK (is_super_admin() OR public.rls_check_is_admin());

-- ============================================================================
-- 4.20 content_dependencies
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage tenant dependencies" ON content_dependencies;
DROP POLICY IF EXISTS "Students can view tenant dependencies" ON content_dependencies;

CREATE POLICY "content_dependencies_admin_all" ON content_dependencies
  FOR ALL
  USING (public.rls_check_admin_member(tenant_id))
  WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "content_dependencies_student_select" ON content_dependencies
  FOR SELECT USING (public.rls_check_tenant_member(tenant_id));

-- ============================================================================
-- 4.21 content_difficulty_analysis
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage difficulty analysis" ON content_difficulty_analysis;

CREATE POLICY "content_difficulty_analysis_admin" ON content_difficulty_analysis
  FOR ALL
  USING (is_super_admin() OR public.rls_check_is_admin())
  WITH CHECK (is_super_admin() OR public.rls_check_is_admin());

-- ============================================================================
-- 4.22 content_partner_sync_logs
-- ============================================================================
DROP POLICY IF EXISTS "Admin tenant isolation for partner_sync_logs" ON content_partner_sync_logs;

CREATE POLICY "content_partner_sync_logs_admin" ON content_partner_sync_logs
  FOR ALL
  USING (public.rls_check_partner_admin(partner_id))
  WITH CHECK (public.rls_check_partner_admin(partner_id));

-- ============================================================================
-- 4.23 content_partners
-- ============================================================================
DROP POLICY IF EXISTS "Admin tenant isolation for content_partners" ON content_partners;

CREATE POLICY "content_partners_admin_all" ON content_partners
  FOR ALL
  USING (public.rls_check_admin_member(tenant_id))
  WITH CHECK (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.24 difficulty_levels
-- ============================================================================
DROP POLICY IF EXISTS "difficulty_levels_insert_policy" ON difficulty_levels;
DROP POLICY IF EXISTS "difficulty_levels_update_policy" ON difficulty_levels;
DROP POLICY IF EXISTS "difficulty_levels_delete_policy" ON difficulty_levels;

CREATE POLICY "difficulty_levels_insert_policy" ON difficulty_levels
  FOR INSERT WITH CHECK (public.rls_check_is_admin());

CREATE POLICY "difficulty_levels_update_policy" ON difficulty_levels
  FOR UPDATE USING (public.rls_check_is_admin());

CREATE POLICY "difficulty_levels_delete_policy" ON difficulty_levels
  FOR DELETE USING (public.rls_check_is_admin());

-- ============================================================================
-- 4.25 enrollments
-- ============================================================================
DROP POLICY IF EXISTS "admin_select_enrollments" ON enrollments;
DROP POLICY IF EXISTS "admin_insert_enrollments" ON enrollments;
DROP POLICY IF EXISTS "admin_update_enrollments" ON enrollments;
DROP POLICY IF EXISTS "admin_delete_enrollments" ON enrollments;

CREATE POLICY "admin_select_enrollments" ON enrollments
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "admin_insert_enrollments" ON enrollments
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "admin_update_enrollments" ON enrollments
  FOR UPDATE USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "admin_delete_enrollments" ON enrollments
  FOR DELETE USING (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.26 file_categories
-- ============================================================================
DROP POLICY IF EXISTS "file_categories_admin_insert" ON file_categories;
DROP POLICY IF EXISTS "file_categories_admin_update" ON file_categories;
DROP POLICY IF EXISTS "file_categories_select" ON file_categories;

CREATE POLICY "file_categories_admin_insert" ON file_categories
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "file_categories_admin_update" ON file_categories
  FOR UPDATE USING (public.rls_check_admin_member(tenant_id));

-- Select: admin of tenant (original parent check had a bug referencing s.id = tenant_id)
CREATE POLICY "file_categories_select" ON file_categories
  FOR SELECT USING (public.rls_check_admin_member(tenant_id) OR public.rls_check_tenant_member(tenant_id));

-- ============================================================================
-- 4.27 file_contexts
-- ============================================================================
DROP POLICY IF EXISTS "file_contexts_select" ON file_contexts;
DROP POLICY IF EXISTS "file_contexts_insert" ON file_contexts;
DROP POLICY IF EXISTS "file_contexts_delete" ON file_contexts;

CREATE POLICY "file_contexts_select" ON file_contexts
  FOR SELECT USING (public.rls_check_file_access(file_id));

CREATE POLICY "file_contexts_insert" ON file_contexts
  FOR INSERT WITH CHECK (public.rls_check_file_owner_or_admin(file_id));

CREATE POLICY "file_contexts_delete" ON file_contexts
  FOR DELETE USING (public.rls_check_file_owner_or_admin(file_id));

-- ============================================================================
-- 4.28 file_distributions
-- ============================================================================
DROP POLICY IF EXISTS "distributions_admin_insert" ON file_distributions;
DROP POLICY IF EXISTS "distributions_admin_update" ON file_distributions;
DROP POLICY IF EXISTS "distributions_admin_delete" ON file_distributions;
DROP POLICY IF EXISTS "distributions_select" ON file_distributions;

CREATE POLICY "distributions_admin_insert" ON file_distributions
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "distributions_admin_update" ON file_distributions
  FOR UPDATE USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "distributions_admin_delete" ON file_distributions
  FOR DELETE USING (public.rls_check_admin_member(tenant_id));

-- Select: student sees own, admin sees tenant, parent sees linked student
CREATE POLICY "distributions_select" ON file_distributions
  FOR SELECT USING (
    student_id = auth.uid()
    OR public.rls_check_admin_member(tenant_id)
    OR public.rls_check_parent_student(student_id)
  );

-- ============================================================================
-- 4.29 file_requests
-- ============================================================================
DROP POLICY IF EXISTS "file_requests_select" ON file_requests;
DROP POLICY IF EXISTS "file_requests_insert" ON file_requests;
DROP POLICY IF EXISTS "file_requests_update" ON file_requests;
DROP POLICY IF EXISTS "file_requests_delete" ON file_requests;

CREATE POLICY "file_requests_select" ON file_requests
  FOR SELECT USING (
    public.rls_check_admin_member(tenant_id)
    OR student_id = auth.uid()
    OR public.rls_check_parent_student(student_id)
  );

CREATE POLICY "file_requests_insert" ON file_requests
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "file_requests_update" ON file_requests
  FOR UPDATE USING (
    public.rls_check_admin_member(tenant_id)
    OR student_id = auth.uid()
    OR public.rls_check_parent_student(student_id)
  );

CREATE POLICY "file_requests_delete" ON file_requests
  FOR DELETE USING (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.30 files
-- ============================================================================
DROP POLICY IF EXISTS "files_student_select" ON files;
DROP POLICY IF EXISTS "files_distribution_select" ON files;
DROP POLICY IF EXISTS "files_update" ON files;
DROP POLICY IF EXISTS "files_delete" ON files;

CREATE POLICY "files_select" ON files
  FOR SELECT USING (
    uploaded_by = auth.uid()
    OR public.rls_check_admin_member(tenant_id)
    OR public.rls_check_parent_student(student_id)
  );

-- Distribution-based select: student_id IS NULL means shared files
CREATE POLICY "files_distribution_select" ON files
  FOR SELECT USING (
    student_id IS NULL AND public.rls_check_file_distribution_select(id)
  );

CREATE POLICY "files_update" ON files
  FOR UPDATE
  USING (uploaded_by = auth.uid() OR public.rls_check_admin_member(tenant_id))
  WITH CHECK (uploaded_by = auth.uid() OR public.rls_check_admin_member(tenant_id));

CREATE POLICY "files_delete" ON files
  FOR DELETE USING (uploaded_by = auth.uid() OR public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.31 flexible_contents — clean up duplicates + replace
-- ============================================================================
-- Drop ALL admin duplicate policies (Korean + English named duplicates)
DROP POLICY IF EXISTS "flexible_contents_admin_all" ON flexible_contents;
DROP POLICY IF EXISTS "flexible_contents_admin_select" ON flexible_contents;
DROP POLICY IF EXISTS "flexible_contents_admin_insert" ON flexible_contents;
DROP POLICY IF EXISTS "flexible_contents_admin_update" ON flexible_contents;
DROP POLICY IF EXISTS "flexible_contents_admin_delete" ON flexible_contents;
DROP POLICY IF EXISTS "관리자는 flexible_contents 조회 가능" ON flexible_contents;
DROP POLICY IF EXISTS "관리자는 flexible_contents 생성 가능" ON flexible_contents;
DROP POLICY IF EXISTS "관리자는 flexible_contents 수정 가능" ON flexible_contents;
DROP POLICY IF EXISTS "관리자는 flexible_contents 삭제 가능" ON flexible_contents;

-- Consolidated admin policy
CREATE POLICY "flexible_contents_admin_all" ON flexible_contents
  FOR ALL
  USING (public.rls_check_admin_full_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_full_tenant(tenant_id));

-- ============================================================================
-- 4.32 google_calendar_sync_queue
-- ============================================================================
DROP POLICY IF EXISTS "tenant_isolation" ON google_calendar_sync_queue;

CREATE POLICY "tenant_isolation" ON google_calendar_sync_queue
  FOR ALL
  USING (public.rls_check_tenant_member(tenant_id))
  WITH CHECK (public.rls_check_tenant_member(tenant_id));

-- ============================================================================
-- 4.33 google_oauth_tokens
-- ============================================================================
DROP POLICY IF EXISTS "tenant_isolation" ON google_oauth_tokens;

CREATE POLICY "tenant_isolation" ON google_oauth_tokens
  FOR ALL
  USING (public.rls_check_tenant_member(tenant_id))
  WITH CHECK (public.rls_check_tenant_member(tenant_id));

-- ============================================================================
-- 4.34 habits
-- ============================================================================
DROP POLICY IF EXISTS "habits_admin_select" ON habits;

CREATE POLICY "habits_admin_select" ON habits
  FOR SELECT USING (public.rls_check_admin_or_superadmin_tenant(tenant_id));

-- ============================================================================
-- 4.35 invitations
-- ============================================================================
DROP POLICY IF EXISTS "invitations_admin_select" ON invitations;
DROP POLICY IF EXISTS "invitations_admin_insert" ON invitations;
DROP POLICY IF EXISTS "invitations_admin_update" ON invitations;
DROP POLICY IF EXISTS "invitations_admin_delete" ON invitations;
DROP POLICY IF EXISTS "invitations_superadmin_all" ON invitations;

CREATE POLICY "invitations_superadmin_all" ON invitations
  FOR ALL
  USING (public.rls_check_is_superadmin())
  WITH CHECK (public.rls_check_is_superadmin());

CREATE POLICY "invitations_admin_select" ON invitations
  FOR SELECT USING (public.rls_check_admin_full_tenant(tenant_id));

CREATE POLICY "invitations_admin_insert" ON invitations
  FOR INSERT WITH CHECK (public.rls_check_admin_full_tenant(tenant_id) AND invited_by = auth.uid());

CREATE POLICY "invitations_admin_update" ON invitations
  FOR UPDATE USING (public.rls_check_admin_or_superadmin_tenant(tenant_id));

CREATE POLICY "invitations_admin_delete" ON invitations
  FOR DELETE USING (public.rls_check_admin_or_superadmin_tenant(tenant_id));

-- ============================================================================
-- 4.36 invite_codes
-- ============================================================================
DROP POLICY IF EXISTS "invite_codes_select_admin" ON invite_codes;
DROP POLICY IF EXISTS "invite_codes_insert_admin" ON invite_codes;
DROP POLICY IF EXISTS "invite_codes_update_admin" ON invite_codes;
DROP POLICY IF EXISTS "invite_codes_delete_admin" ON invite_codes;

CREATE POLICY "invite_codes_select_admin" ON invite_codes
  FOR SELECT USING (public.rls_check_is_admin());

CREATE POLICY "invite_codes_insert_admin" ON invite_codes
  FOR INSERT WITH CHECK (public.rls_check_is_admin());

CREATE POLICY "invite_codes_update_admin" ON invite_codes
  FOR UPDATE USING (public.rls_check_is_admin());

CREATE POLICY "invite_codes_delete_admin" ON invite_codes
  FOR DELETE USING (public.rls_check_is_admin());

-- ============================================================================
-- 4.37 lead_activities
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view own tenant lead activities" ON lead_activities;
DROP POLICY IF EXISTS "Admins can create lead activities in own tenant" ON lead_activities;
DROP POLICY IF EXISTS "Admins can update lead activities in own tenant" ON lead_activities;
DROP POLICY IF EXISTS "Admins can delete lead activities in own tenant" ON lead_activities;

CREATE POLICY "lead_activities_select" ON lead_activities
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "lead_activities_insert" ON lead_activities
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "lead_activities_update" ON lead_activities
  FOR UPDATE USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "lead_activities_delete" ON lead_activities
  FOR DELETE USING (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.38 lead_score_logs
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view own tenant score logs" ON lead_score_logs;
DROP POLICY IF EXISTS "Admins can create score logs in own tenant" ON lead_score_logs;

CREATE POLICY "lead_score_logs_select" ON lead_score_logs
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "lead_score_logs_insert" ON lead_score_logs
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.39 lead_tasks
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view own tenant tasks" ON lead_tasks;
DROP POLICY IF EXISTS "Admins can create tasks in own tenant" ON lead_tasks;
DROP POLICY IF EXISTS "Admins can update own tenant tasks" ON lead_tasks;
DROP POLICY IF EXISTS "Admins can delete own tenant tasks" ON lead_tasks;

CREATE POLICY "lead_tasks_select" ON lead_tasks
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "lead_tasks_insert" ON lead_tasks
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "lead_tasks_update" ON lead_tasks
  FOR UPDATE USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "lead_tasks_delete" ON lead_tasks
  FOR DELETE USING (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.40 lecture_episodes
-- ============================================================================
DROP POLICY IF EXISTS "lecture_episodes_modify_admin" ON lecture_episodes;

CREATE POLICY "lecture_episodes_modify_admin" ON lecture_episodes
  FOR ALL
  USING (public.rls_check_is_admin())
  WITH CHECK (public.rls_check_is_admin());

-- ============================================================================
-- 4.41 llm_response_cache
-- ============================================================================
DROP POLICY IF EXISTS "llm_cache_admin_only" ON llm_response_cache;

CREATE POLICY "llm_cache_admin_only" ON llm_response_cache
  FOR ALL
  USING (public.rls_check_admin_or_superadmin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_or_superadmin_tenant(tenant_id));

-- ============================================================================
-- 4.42 master_books
-- ============================================================================
DROP POLICY IF EXISTS "master_books_insert_admin" ON master_books;
DROP POLICY IF EXISTS "master_books_update_admin" ON master_books;
DROP POLICY IF EXISTS "master_books_delete_admin" ON master_books;

CREATE POLICY "master_books_insert_admin" ON master_books
  FOR INSERT WITH CHECK (public.rls_check_is_admin());

CREATE POLICY "master_books_update_admin" ON master_books
  FOR UPDATE USING (public.rls_check_is_admin());

CREATE POLICY "master_books_delete_admin" ON master_books
  FOR DELETE USING (public.rls_check_is_admin());

-- ============================================================================
-- 4.43 master_custom_contents
-- ============================================================================
DROP POLICY IF EXISTS "master_custom_contents_select_policy" ON master_custom_contents;
DROP POLICY IF EXISTS "master_custom_contents_insert_policy" ON master_custom_contents;
DROP POLICY IF EXISTS "master_custom_contents_update_policy" ON master_custom_contents;
DROP POLICY IF EXISTS "master_custom_contents_delete_policy" ON master_custom_contents;

-- SELECT: global (tenant_id IS NULL) or user's tenant
CREATE POLICY "master_custom_contents_select" ON master_custom_contents
  FOR SELECT USING (tenant_id IS NULL OR public.rls_check_tenant_member(tenant_id));

-- INSERT: admin/consultant only
CREATE POLICY "master_custom_contents_insert" ON master_custom_contents
  FOR INSERT WITH CHECK (public.rls_check_is_admin_or_consultant());

-- UPDATE: admin/consultant in matching tenant (or global)
CREATE POLICY "master_custom_contents_update" ON master_custom_contents
  FOR UPDATE USING (
    public.rls_check_is_admin_or_consultant()
    AND (tenant_id IS NULL OR public.rls_check_admin_tenant(tenant_id))
  );

-- DELETE: admin/consultant in matching tenant (or global)
CREATE POLICY "master_custom_contents_delete" ON master_custom_contents
  FOR DELETE USING (
    public.rls_check_is_admin_or_consultant()
    AND (tenant_id IS NULL OR public.rls_check_admin_tenant(tenant_id))
  );

-- ============================================================================
-- 4.44 master_instructors
-- ============================================================================
DROP POLICY IF EXISTS "master_instructors_insert_admin" ON master_instructors;
DROP POLICY IF EXISTS "master_instructors_update_admin" ON master_instructors;
DROP POLICY IF EXISTS "master_instructors_delete_admin" ON master_instructors;

CREATE POLICY "master_instructors_insert_admin" ON master_instructors
  FOR INSERT WITH CHECK (public.rls_check_is_admin());

CREATE POLICY "master_instructors_update_admin" ON master_instructors
  FOR UPDATE USING (public.rls_check_is_admin());

CREATE POLICY "master_instructors_delete_admin" ON master_instructors
  FOR DELETE USING (public.rls_check_is_admin());

-- ============================================================================
-- 4.45 master_lectures
-- ============================================================================
DROP POLICY IF EXISTS "master_lectures_insert_admin" ON master_lectures;
DROP POLICY IF EXISTS "master_lectures_update_admin" ON master_lectures;
DROP POLICY IF EXISTS "master_lectures_delete_admin" ON master_lectures;

CREATE POLICY "master_lectures_insert_admin" ON master_lectures
  FOR INSERT WITH CHECK (public.rls_check_is_admin());

CREATE POLICY "master_lectures_update_admin" ON master_lectures
  FOR UPDATE USING (public.rls_check_is_admin());

CREATE POLICY "master_lectures_delete_admin" ON master_lectures
  FOR DELETE USING (public.rls_check_is_admin());

-- ============================================================================
-- 4.46 parent_student_links — clean up duplicates + replace
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view all parent-student links" ON parent_student_links;
DROP POLICY IF EXISTS "Admins can insert parent-student links" ON parent_student_links;
DROP POLICY IF EXISTS "Admins can update parent-student links" ON parent_student_links;
DROP POLICY IF EXISTS "Admins can delete parent-student links" ON parent_student_links;
DROP POLICY IF EXISTS "parent_student_links_delete_for_admin" ON parent_student_links;
DROP POLICY IF EXISTS "parent_student_links_update_for_admin" ON parent_student_links;

-- Consolidated admin policies
CREATE POLICY "parent_student_links_admin_select" ON parent_student_links
  FOR SELECT USING (public.rls_check_is_admin_or_consultant());

CREATE POLICY "parent_student_links_admin_insert" ON parent_student_links
  FOR INSERT WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "parent_student_links_admin_update" ON parent_student_links
  FOR UPDATE
  USING (public.rls_check_is_admin())
  WITH CHECK (public.rls_check_is_admin());

CREATE POLICY "parent_student_links_admin_delete" ON parent_student_links
  FOR DELETE USING (public.rls_check_is_admin());

-- ============================================================================
-- 4.47 parent_users
-- ============================================================================
DROP POLICY IF EXISTS "tenant_isolation_parent_users_select" ON parent_users;
DROP POLICY IF EXISTS "tenant_isolation_parent_users_update" ON parent_users;
DROP POLICY IF EXISTS "tenant_isolation_parent_users_delete" ON parent_users;

CREATE POLICY "tenant_isolation_parent_users_select" ON parent_users
  FOR SELECT USING (
    is_super_admin()
    OR auth.uid() = id
    OR public.rls_check_admin_tenant(tenant_id)
    OR public.rls_check_tenant_member(tenant_id)
  );

CREATE POLICY "tenant_isolation_parent_users_update" ON parent_users
  FOR UPDATE
  USING (
    is_super_admin()
    OR (auth.uid() = id AND public.rls_check_tenant_member(tenant_id))
    OR public.rls_check_admin_tenant(tenant_id)
  )
  WITH CHECK (
    is_super_admin()
    OR (auth.uid() = id AND public.rls_check_tenant_member(tenant_id))
    OR public.rls_check_admin_tenant(tenant_id)
  );

CREATE POLICY "tenant_isolation_parent_users_delete" ON parent_users
  FOR DELETE USING (
    is_super_admin()
    OR public.rls_check_admin_only_tenant(tenant_id)
  );

-- ============================================================================
-- 4.48 payment_orders
-- ============================================================================
DROP POLICY IF EXISTS "po_admin_select" ON payment_orders;
DROP POLICY IF EXISTS "po_admin_insert" ON payment_orders;
DROP POLICY IF EXISTS "po_admin_update" ON payment_orders;
DROP POLICY IF EXISTS "po_admin_delete" ON payment_orders;
DROP POLICY IF EXISTS "po_parent_select" ON payment_orders;

CREATE POLICY "po_admin_select" ON payment_orders
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "po_admin_insert" ON payment_orders
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "po_admin_update" ON payment_orders
  FOR UPDATE USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "po_admin_delete" ON payment_orders
  FOR DELETE USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "po_parent_select" ON payment_orders
  FOR SELECT USING (public.rls_check_payment_order_parent(id));

-- ============================================================================
-- 4.49 payment_records
-- ============================================================================
DROP POLICY IF EXISTS "admin_select_payment_records" ON payment_records;
DROP POLICY IF EXISTS "admin_insert_payment_records" ON payment_records;
DROP POLICY IF EXISTS "admin_update_payment_records" ON payment_records;
DROP POLICY IF EXISTS "admin_delete_payment_records" ON payment_records;

CREATE POLICY "admin_select_payment_records" ON payment_records
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "admin_insert_payment_records" ON payment_records
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "admin_update_payment_records" ON payment_records
  FOR UPDATE USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "admin_delete_payment_records" ON payment_records
  FOR DELETE USING (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.50 permission_definitions
-- ============================================================================
DROP POLICY IF EXISTS "permission_definitions_select" ON permission_definitions;

CREATE POLICY "permission_definitions_select" ON permission_definitions
  FOR SELECT USING (public.rls_check_is_admin());

-- ============================================================================
-- 4.51 plan_contents
-- ============================================================================
DROP POLICY IF EXISTS "tenant_isolation_plan_contents" ON plan_contents;

CREATE POLICY "plan_contents_access" ON plan_contents
  FOR ALL
  USING (public.rls_check_plan_group_access(plan_group_id))
  WITH CHECK (public.rls_check_plan_group_access(plan_group_id));

-- ============================================================================
-- 4.52 plan_creation_history
-- ============================================================================
DROP POLICY IF EXISTS "이력은 같은 테넌트의 관리자만 조회 가능" ON plan_creation_history;
DROP POLICY IF EXISTS "이력은 테넌트 관리자만 생성 가능" ON plan_creation_history;
DROP POLICY IF EXISTS "이력은 테넌트 관리자만 수정 가능" ON plan_creation_history;

CREATE POLICY "plan_creation_history_select" ON plan_creation_history
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "plan_creation_history_insert" ON plan_creation_history
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "plan_creation_history_update" ON plan_creation_history
  FOR UPDATE USING (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.53 plan_creation_templates
-- ============================================================================
DROP POLICY IF EXISTS "템플릿은 같은 테넌트의 관리자만 조회 가능" ON plan_creation_templates;
DROP POLICY IF EXISTS "템플릿은 테넌트 관리자만 생성 가능" ON plan_creation_templates;
DROP POLICY IF EXISTS "템플릿은 테넌트 관리자만 수정 가능" ON plan_creation_templates;
DROP POLICY IF EXISTS "템플릿은 테넌트 관리자만 삭제 가능" ON plan_creation_templates;

CREATE POLICY "plan_creation_templates_select" ON plan_creation_templates
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "plan_creation_templates_insert" ON plan_creation_templates
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "plan_creation_templates_update" ON plan_creation_templates
  FOR UPDATE USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "plan_creation_templates_delete" ON plan_creation_templates
  FOR DELETE USING (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.54 plan_events
-- ============================================================================
DROP POLICY IF EXISTS "관리자는 plan_events 조회 가능" ON plan_events;
DROP POLICY IF EXISTS "관리자는 plan_events 생성 가능" ON plan_events;

CREATE POLICY "plan_events_admin_select" ON plan_events
  FOR SELECT USING (public.rls_check_admin_full_tenant(tenant_id));

CREATE POLICY "plan_events_admin_insert" ON plan_events
  FOR INSERT WITH CHECK (public.rls_check_admin_full_tenant(tenant_id));

-- ============================================================================
-- 4.55 plan_execution_logs
-- ============================================================================
DROP POLICY IF EXISTS "plan_execution_logs_admin_all" ON plan_execution_logs;

CREATE POLICY "plan_execution_logs_admin_all" ON plan_execution_logs
  FOR ALL
  USING (public.rls_check_admin_member(tenant_id))
  WITH CHECK (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.56 plan_group_backups
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage tenant backups" ON plan_group_backups;

CREATE POLICY "plan_group_backups_admin" ON plan_group_backups
  FOR ALL
  USING (public.rls_check_admin_member(tenant_id))
  WITH CHECK (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.57 plan_group_items
-- ============================================================================
DROP POLICY IF EXISTS "plan_group_items_admin_all" ON plan_group_items;

CREATE POLICY "plan_group_items_admin_all" ON plan_group_items
  FOR ALL
  USING (public.rls_check_admin_member(tenant_id))
  WITH CHECK (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.58 plan_groups — clean up duplicates + replace
-- ============================================================================
DROP POLICY IF EXISTS "plan_groups_admin_all" ON plan_groups;
DROP POLICY IF EXISTS "tenant_isolation_plan_groups" ON plan_groups;

-- Admin
CREATE POLICY "plan_groups_admin_all" ON plan_groups
  FOR ALL
  USING (public.rls_check_admin_member(tenant_id))
  WITH CHECK (public.rls_check_admin_member(tenant_id));

-- Multi-role access (student/admin/parent)
CREATE POLICY "plan_groups_multi_access" ON plan_groups
  FOR ALL
  USING (
    student_id = auth.uid()
    OR public.rls_check_admin_member(tenant_id)
    OR public.rls_check_parent_student(student_id)
  )
  WITH CHECK (
    student_id = auth.uid()
    OR public.rls_check_admin_member(tenant_id)
    OR public.rls_check_parent_student(student_id)
  );

-- ============================================================================
-- 4.59 plan_history
-- ============================================================================
DROP POLICY IF EXISTS "admin_access_plan_history" ON plan_history;

CREATE POLICY "admin_access_plan_history" ON plan_history
  FOR ALL
  USING (public.rls_check_admin_member(tenant_id))
  WITH CHECK (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.60 plan_reminder_logs
-- ============================================================================
DROP POLICY IF EXISTS "admin_reminder_logs" ON plan_reminder_logs;

CREATE POLICY "admin_reminder_logs" ON plan_reminder_logs
  FOR ALL
  USING (public.rls_check_student_tenant_admin(student_id))
  WITH CHECK (public.rls_check_student_tenant_admin(student_id));

-- ============================================================================
-- 4.61 plan_satisfaction_ratings — clean up duplicates
-- ============================================================================
DROP POLICY IF EXISTS "satisfaction_admin_all" ON plan_satisfaction_ratings;
DROP POLICY IF EXISTS "satisfaction_admin_select" ON plan_satisfaction_ratings;

CREATE POLICY "satisfaction_admin_all" ON plan_satisfaction_ratings
  FOR ALL
  USING (public.rls_check_admin_member(tenant_id))
  WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "satisfaction_admin_select" ON plan_satisfaction_ratings
  FOR SELECT USING (public.rls_check_admin_tenant(tenant_id));

-- ============================================================================
-- 4.62 plan_templates
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage plan templates" ON plan_templates;

CREATE POLICY "plan_templates_admin" ON plan_templates
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- ============================================================================
-- 4.63 plan_views
-- ============================================================================
DROP POLICY IF EXISTS "plan_views_admin_read" ON plan_views;

CREATE POLICY "plan_views_admin_read" ON plan_views
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.64 programs
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view own tenant programs" ON programs;
DROP POLICY IF EXISTS "Admins can create programs in own tenant" ON programs;
DROP POLICY IF EXISTS "Admins can update own tenant programs" ON programs;
DROP POLICY IF EXISTS "Admins can delete own tenant programs" ON programs;

CREATE POLICY "programs_select" ON programs
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "programs_insert" ON programs
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "programs_update" ON programs
  FOR UPDATE USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "programs_delete" ON programs
  FOR DELETE USING (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.65 recommendation_settings
-- ============================================================================
DROP POLICY IF EXISTS "recommendation_settings_select" ON recommendation_settings;
DROP POLICY IF EXISTS "recommendation_settings_insert" ON recommendation_settings;
DROP POLICY IF EXISTS "recommendation_settings_update" ON recommendation_settings;
DROP POLICY IF EXISTS "recommendation_settings_delete" ON recommendation_settings;

CREATE POLICY "recommendation_settings_select" ON recommendation_settings
  FOR SELECT USING (tenant_id IS NULL OR public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "recommendation_settings_insert" ON recommendation_settings
  FOR INSERT WITH CHECK (tenant_id IS NULL OR public.rls_check_admin_only_tenant(tenant_id));

CREATE POLICY "recommendation_settings_update" ON recommendation_settings
  FOR UPDATE USING (tenant_id IS NULL OR public.rls_check_admin_only_tenant(tenant_id));

CREATE POLICY "recommendation_settings_delete" ON recommendation_settings
  FOR DELETE USING (tenant_id IS NULL OR public.rls_check_admin_only_tenant(tenant_id));

-- ============================================================================
-- 4.66 request_templates
-- ============================================================================
DROP POLICY IF EXISTS "request_templates_select" ON request_templates;
DROP POLICY IF EXISTS "request_templates_admin_insert" ON request_templates;
DROP POLICY IF EXISTS "request_templates_admin_update" ON request_templates;
DROP POLICY IF EXISTS "request_templates_admin_delete" ON request_templates;

CREATE POLICY "request_templates_select" ON request_templates
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "request_templates_admin_insert" ON request_templates
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "request_templates_admin_update" ON request_templates
  FOR UPDATE USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "request_templates_admin_delete" ON request_templates
  FOR DELETE USING (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.67 reschedule_log
-- ============================================================================
DROP POLICY IF EXISTS "admin_access_reschedule_log" ON reschedule_log;

CREATE POLICY "admin_access_reschedule_log" ON reschedule_log
  FOR ALL
  USING (public.rls_check_admin_member(tenant_id))
  WITH CHECK (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.68 role_permissions
-- ============================================================================
DROP POLICY IF EXISTS "role_permissions_select_admin" ON role_permissions;
DROP POLICY IF EXISTS "role_permissions_insert_admin" ON role_permissions;
DROP POLICY IF EXISTS "role_permissions_update_admin" ON role_permissions;
DROP POLICY IF EXISTS "role_permissions_delete_admin" ON role_permissions;

CREATE POLICY "role_permissions_select_admin" ON role_permissions
  FOR SELECT USING (public.rls_check_admin_only_tenant(tenant_id) OR (tenant_id IS NULL AND public.rls_check_is_admin()));

CREATE POLICY "role_permissions_insert_admin" ON role_permissions
  FOR INSERT WITH CHECK (public.rls_check_admin_only_tenant(tenant_id) OR (tenant_id IS NULL AND public.rls_check_is_admin()));

CREATE POLICY "role_permissions_update_admin" ON role_permissions
  FOR UPDATE USING (public.rls_check_admin_only_tenant(tenant_id) OR (tenant_id IS NULL AND public.rls_check_is_admin()));

CREATE POLICY "role_permissions_delete_admin" ON role_permissions
  FOR DELETE USING (public.rls_check_admin_only_tenant(tenant_id) OR (tenant_id IS NULL AND public.rls_check_is_admin()));

-- ============================================================================
-- 4.69 sales_leads
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view own tenant leads" ON sales_leads;
DROP POLICY IF EXISTS "Admins can create leads in own tenant" ON sales_leads;
DROP POLICY IF EXISTS "Admins can update own tenant leads" ON sales_leads;
DROP POLICY IF EXISTS "Admins can delete own tenant leads" ON sales_leads;

CREATE POLICY "sales_leads_select" ON sales_leads
  FOR SELECT USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "sales_leads_insert" ON sales_leads
  FOR INSERT WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "sales_leads_update" ON sales_leads
  FOR UPDATE USING (public.rls_check_admin_member(tenant_id));

CREATE POLICY "sales_leads_delete" ON sales_leads
  FOR DELETE USING (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.70 slot_template_presets
-- ============================================================================
DROP POLICY IF EXISTS "slot_template_presets_admin_all" ON slot_template_presets;

CREATE POLICY "slot_template_presets_admin_all" ON slot_template_presets
  FOR ALL
  USING (public.rls_check_admin_member(tenant_id))
  WITH CHECK (public.rls_check_admin_member(tenant_id));

-- ============================================================================
-- 4.71 sms_logs
-- ============================================================================
DROP POLICY IF EXISTS "sms_logs_select_admin" ON sms_logs;
DROP POLICY IF EXISTS "sms_logs_insert_admin" ON sms_logs;
DROP POLICY IF EXISTS "sms_logs_update_admin" ON sms_logs;

CREATE POLICY "sms_logs_select_admin" ON sms_logs
  FOR SELECT USING (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "sms_logs_insert_admin" ON sms_logs
  FOR INSERT WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "sms_logs_update_admin" ON sms_logs
  FOR UPDATE USING (public.rls_check_admin_tenant(tenant_id));

-- ============================================================================
-- 4.72 student_analysis
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view all analysis in their tenant" ON student_analysis;

CREATE POLICY "student_analysis_admin_select" ON student_analysis
  FOR SELECT USING (public.rls_check_admin_tenant(tenant_id));

-- ============================================================================
-- 4.73 student_connection_history
-- ============================================================================
DROP POLICY IF EXISTS "connection_history_select" ON student_connection_history;

CREATE POLICY "connection_history_select" ON student_connection_history
  FOR SELECT USING (public.rls_check_is_admin());

-- ============================================================================
-- 4.74 student_consulting_notes
-- ============================================================================
DROP POLICY IF EXISTS "tenant_isolation_consulting_notes_select" ON student_consulting_notes;
DROP POLICY IF EXISTS "tenant_isolation_consulting_notes_insert" ON student_consulting_notes;
DROP POLICY IF EXISTS "tenant_isolation_consulting_notes_update" ON student_consulting_notes;
DROP POLICY IF EXISTS "tenant_isolation_consulting_notes_delete" ON student_consulting_notes;

CREATE POLICY "consulting_notes_select" ON student_consulting_notes
  FOR SELECT USING (
    is_super_admin()
    OR auth.uid() = student_id
    OR public.rls_check_admin_tenant(tenant_id)
    OR public.rls_check_parent_student(student_id)
  );

CREATE POLICY "consulting_notes_insert" ON student_consulting_notes
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR (public.rls_check_admin_tenant(tenant_id) AND consultant_id = auth.uid())
  );

CREATE POLICY "consulting_notes_update" ON student_consulting_notes
  FOR UPDATE
  USING (
    is_super_admin()
    OR (public.rls_check_admin_tenant(tenant_id) AND consultant_id = auth.uid())
  )
  WITH CHECK (
    is_super_admin()
    OR (public.rls_check_admin_tenant(tenant_id) AND consultant_id = auth.uid())
  );

CREATE POLICY "consulting_notes_delete" ON student_consulting_notes
  FOR DELETE USING (
    is_super_admin()
    OR (public.rls_check_admin_tenant(tenant_id) AND consultant_id = auth.uid())
  );

-- ============================================================================
-- 4.75 student_content_progress
-- ============================================================================
DROP POLICY IF EXISTS "tenant_isolation_content_progress_select" ON student_content_progress;
DROP POLICY IF EXISTS "tenant_isolation_content_progress_insert" ON student_content_progress;
DROP POLICY IF EXISTS "tenant_isolation_content_progress_update" ON student_content_progress;
DROP POLICY IF EXISTS "tenant_isolation_content_progress_delete" ON student_content_progress;

CREATE POLICY "content_progress_select" ON student_content_progress
  FOR SELECT USING (
    is_super_admin()
    OR auth.uid() = student_id
    OR public.rls_check_admin_tenant(tenant_id)
    OR public.rls_check_parent_student(student_id)
  );

CREATE POLICY "content_progress_insert" ON student_content_progress
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR auth.uid() = student_id
    OR public.rls_check_admin_tenant(tenant_id)
  );

CREATE POLICY "content_progress_update" ON student_content_progress
  FOR UPDATE
  USING (
    is_super_admin()
    OR auth.uid() = student_id
    OR public.rls_check_admin_tenant(tenant_id)
  )
  WITH CHECK (
    is_super_admin()
    OR auth.uid() = student_id
    OR public.rls_check_admin_tenant(tenant_id)
  );

CREATE POLICY "content_progress_delete" ON student_content_progress
  FOR DELETE USING (
    is_super_admin()
    OR auth.uid() = student_id
    OR public.rls_check_admin_tenant(tenant_id)
  );

-- ============================================================================
-- 4.76 student_internal_scores
-- ============================================================================
-- Fix nested student subquery (student_id IN (SELECT students.id FROM students WHERE students.id = auth.uid()))
-- This is equivalent to student_id = auth.uid() since it just checks students table membership
DROP POLICY IF EXISTS "Students can manage own internal scores" ON student_internal_scores;
DROP POLICY IF EXISTS "Students can view own internal scores" ON student_internal_scores;
DROP POLICY IF EXISTS "admin_users_manage_student_internal_scores" ON student_internal_scores;

CREATE POLICY "student_internal_scores_student" ON student_internal_scores
  FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "student_internal_scores_admin" ON student_internal_scores
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- ============================================================================
-- 4.77 student_milestone_logs
-- ============================================================================
DROP POLICY IF EXISTS "admin_milestone_logs" ON student_milestone_logs;

CREATE POLICY "admin_milestone_logs" ON student_milestone_logs
  FOR ALL
  USING (public.rls_check_student_tenant_admin(student_id))
  WITH CHECK (public.rls_check_student_tenant_admin(student_id));

-- ============================================================================
-- 4.78 student_milestone_settings
-- ============================================================================
DROP POLICY IF EXISTS "admin_milestone_settings" ON student_milestone_settings;

CREATE POLICY "admin_milestone_settings" ON student_milestone_settings
  FOR ALL
  USING (public.rls_check_student_tenant_admin(student_id))
  WITH CHECK (public.rls_check_student_tenant_admin(student_id));

-- ============================================================================
-- 4.79 student_mock_scores
-- ============================================================================
DROP POLICY IF EXISTS "Students can manage own mock scores" ON student_mock_scores;
DROP POLICY IF EXISTS "Students can view own mock scores" ON student_mock_scores;
DROP POLICY IF EXISTS "admin_users_manage_student_mock_scores" ON student_mock_scores;

CREATE POLICY "student_mock_scores_student" ON student_mock_scores
  FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "student_mock_scores_admin" ON student_mock_scores
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- ============================================================================
-- 4.80 student_plan — clean up duplicates + replace
-- ============================================================================
DROP POLICY IF EXISTS "student_plan_admin_all" ON student_plan;
DROP POLICY IF EXISTS "tenant_isolation_student_plan_select" ON student_plan;
DROP POLICY IF EXISTS "tenant_isolation_student_plan_insert" ON student_plan;
DROP POLICY IF EXISTS "tenant_isolation_student_plan_update" ON student_plan;
DROP POLICY IF EXISTS "tenant_isolation_student_plan_delete" ON student_plan;

-- Admin
CREATE POLICY "student_plan_admin_all" ON student_plan
  FOR ALL
  USING (public.rls_check_admin_member(tenant_id))
  WITH CHECK (public.rls_check_admin_member(tenant_id));

-- SELECT: student/admin/parent
CREATE POLICY "student_plan_select" ON student_plan
  FOR SELECT USING (
    is_super_admin()
    OR auth.uid() = student_id
    OR public.rls_check_admin_tenant(tenant_id)
    OR public.rls_check_parent_student(student_id)
  );

-- INSERT: student or admin
CREATE POLICY "student_plan_insert" ON student_plan
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR auth.uid() = student_id
    OR public.rls_check_admin_tenant(tenant_id)
  );

-- UPDATE: student or admin
CREATE POLICY "student_plan_update" ON student_plan
  FOR UPDATE
  USING (
    is_super_admin()
    OR auth.uid() = student_id
    OR public.rls_check_admin_tenant(tenant_id)
  )
  WITH CHECK (
    is_super_admin()
    OR auth.uid() = student_id
    OR public.rls_check_admin_tenant(tenant_id)
  );

-- DELETE: student or admin
CREATE POLICY "student_plan_delete" ON student_plan
  FOR DELETE USING (
    is_super_admin()
    OR auth.uid() = student_id
    OR public.rls_check_admin_tenant(tenant_id)
  );

-- ============================================================================
-- 4.81 student_reminder_settings
-- ============================================================================
DROP POLICY IF EXISTS "admin_reminder_settings" ON student_reminder_settings;

CREATE POLICY "admin_reminder_settings" ON student_reminder_settings
  FOR ALL
  USING (public.rls_check_student_tenant_admin(student_id))
  WITH CHECK (public.rls_check_student_tenant_admin(student_id));

-- ============================================================================
-- 4.82 student_score_analysis_cache
-- ============================================================================
DROP POLICY IF EXISTS "Students can view own score analysis cache" ON student_score_analysis_cache;
DROP POLICY IF EXISTS "admin_users_manage_score_analysis_cache" ON student_score_analysis_cache;

CREATE POLICY "score_analysis_cache_student" ON student_score_analysis_cache
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "score_analysis_cache_admin" ON student_score_analysis_cache
  FOR ALL
  USING (public.rls_check_student_tenant_admin(student_id))
  WITH CHECK (public.rls_check_student_tenant_admin(student_id));

-- ============================================================================
-- 4.83 student_score_events
-- ============================================================================
DROP POLICY IF EXISTS "Students can view own score events" ON student_score_events;
DROP POLICY IF EXISTS "admin_users_manage_score_events" ON student_score_events;

CREATE POLICY "score_events_student" ON student_score_events
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "score_events_admin" ON student_score_events
  FOR ALL
  USING (public.rls_check_student_tenant_admin(student_id))
  WITH CHECK (public.rls_check_student_tenant_admin(student_id));

-- ============================================================================
-- 4.84 student_terms
-- ============================================================================
DROP POLICY IF EXISTS "Students can manage own terms" ON student_terms;
DROP POLICY IF EXISTS "Students can view own terms" ON student_terms;
DROP POLICY IF EXISTS "admin_users_manage_student_terms" ON student_terms;

CREATE POLICY "student_terms_student" ON student_terms
  FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "student_terms_admin" ON student_terms
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- ============================================================================
-- 4.85 students
-- ============================================================================
DROP POLICY IF EXISTS "tenant_isolation_students_select" ON students;
DROP POLICY IF EXISTS "tenant_isolation_students_insert" ON students;
DROP POLICY IF EXISTS "tenant_isolation_students_update" ON students;
DROP POLICY IF EXISTS "students_insert_admin" ON students;
DROP POLICY IF EXISTS "Parents can view linked students" ON students;

CREATE POLICY "students_select" ON students
  FOR SELECT USING (
    is_super_admin()
    OR auth.uid() = id
    OR public.rls_check_tenant_member(tenant_id)
  );

CREATE POLICY "students_insert" ON students
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR public.rls_check_admin_tenant(tenant_id)
    OR public.rls_check_tenant_member(tenant_id)
  );

CREATE POLICY "students_update" ON students
  FOR UPDATE
  USING (
    is_super_admin()
    OR auth.uid() = id
    OR public.rls_check_admin_tenant(tenant_id)
  )
  WITH CHECK (
    is_super_admin()
    OR auth.uid() = id
    OR public.rls_check_admin_tenant(tenant_id)
  );

-- Parent can view linked students
CREATE POLICY "students_parent_select" ON students
  FOR SELECT USING (public.rls_check_parent_student(id));

-- ============================================================================
-- 4.86 team_invitations
-- ============================================================================
DROP POLICY IF EXISTS "Superadmins can manage all invitations" ON team_invitations;
DROP POLICY IF EXISTS "Tenant admins can view own tenant invitations" ON team_invitations;
DROP POLICY IF EXISTS "Tenant admins can create invitations" ON team_invitations;
DROP POLICY IF EXISTS "Tenant admins can update own tenant invitations" ON team_invitations;

CREATE POLICY "team_invitations_superadmin" ON team_invitations
  FOR ALL
  USING (public.rls_check_is_superadmin())
  WITH CHECK (public.rls_check_is_superadmin());

CREATE POLICY "team_invitations_admin_select" ON team_invitations
  FOR SELECT USING (public.rls_check_admin_or_superadmin_tenant(tenant_id));

CREATE POLICY "team_invitations_admin_insert" ON team_invitations
  FOR INSERT WITH CHECK (public.rls_check_admin_or_superadmin_tenant(tenant_id) AND invited_by = auth.uid());

CREATE POLICY "team_invitations_admin_update" ON team_invitations
  FOR UPDATE USING (public.rls_check_admin_or_superadmin_tenant(tenant_id));

-- ============================================================================
-- 4.87 tenant_block_sets
-- ============================================================================
-- Original uses is_admin_or_consultant() + get_user_tenant_id()
DROP POLICY IF EXISTS "Users can view tenant block sets in their tenant" ON tenant_block_sets;
DROP POLICY IF EXISTS "tenant_block_sets_insert_for_admin" ON tenant_block_sets;
DROP POLICY IF EXISTS "tenant_block_sets_update_for_admin" ON tenant_block_sets;
DROP POLICY IF EXISTS "tenant_block_sets_delete_for_admin" ON tenant_block_sets;

CREATE POLICY "tenant_block_sets_select" ON tenant_block_sets
  FOR SELECT USING (is_super_admin() OR public.rls_check_tenant_member(tenant_id));

CREATE POLICY "tenant_block_sets_admin_insert" ON tenant_block_sets
  FOR INSERT WITH CHECK (is_super_admin() OR public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "tenant_block_sets_admin_update" ON tenant_block_sets
  FOR UPDATE
  USING (is_super_admin() OR public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (is_super_admin() OR public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "tenant_block_sets_admin_delete" ON tenant_block_sets
  FOR DELETE USING (is_super_admin() OR public.rls_check_admin_tenant(tenant_id));

-- ============================================================================
-- 4.88 tenant_blocks
-- ============================================================================
-- Original joins tenant_block_sets + uses get_user_tenant_id()
DROP POLICY IF EXISTS "Users can view tenant blocks in their tenant" ON tenant_blocks;
DROP POLICY IF EXISTS "tenant_blocks_insert_for_admin" ON tenant_blocks;
DROP POLICY IF EXISTS "tenant_blocks_update_for_admin" ON tenant_blocks;
DROP POLICY IF EXISTS "tenant_blocks_delete_for_admin" ON tenant_blocks;

CREATE POLICY "tenant_blocks_select" ON tenant_blocks
  FOR SELECT USING (is_super_admin() OR public.rls_check_block_set_member(tenant_block_set_id));

CREATE POLICY "tenant_blocks_admin_insert" ON tenant_blocks
  FOR INSERT WITH CHECK (is_super_admin() OR public.rls_check_block_set_admin(tenant_block_set_id));

CREATE POLICY "tenant_blocks_admin_update" ON tenant_blocks
  FOR UPDATE
  USING (is_super_admin() OR public.rls_check_block_set_admin(tenant_block_set_id))
  WITH CHECK (is_super_admin() OR public.rls_check_block_set_admin(tenant_block_set_id));

CREATE POLICY "tenant_blocks_admin_delete" ON tenant_blocks
  FOR DELETE USING (is_super_admin() OR public.rls_check_block_set_admin(tenant_block_set_id));

-- ============================================================================
-- 4.89 tenant_scheduler_settings
-- ============================================================================
DROP POLICY IF EXISTS "tenant_scheduler_settings_select" ON tenant_scheduler_settings;
DROP POLICY IF EXISTS "tenant_scheduler_settings_insert" ON tenant_scheduler_settings;
DROP POLICY IF EXISTS "tenant_scheduler_settings_update" ON tenant_scheduler_settings;

CREATE POLICY "tenant_scheduler_settings_select" ON tenant_scheduler_settings
  FOR SELECT USING (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "tenant_scheduler_settings_insert" ON tenant_scheduler_settings
  FOR INSERT WITH CHECK (public.rls_check_admin_only_tenant(tenant_id));

CREATE POLICY "tenant_scheduler_settings_update" ON tenant_scheduler_settings
  FOR UPDATE USING (public.rls_check_admin_only_tenant(tenant_id));

-- ============================================================================
-- 4.90 terms_contents
-- ============================================================================
DROP POLICY IF EXISTS "Super Admin can manage terms contents" ON terms_contents;

CREATE POLICY "terms_contents_superadmin" ON terms_contents
  FOR ALL
  USING (public.rls_check_is_superadmin())
  WITH CHECK (public.rls_check_is_superadmin());

-- ============================================================================
-- 4.91 time_slots
-- ============================================================================
DROP POLICY IF EXISTS "time_slots_admin_write" ON time_slots;
DROP POLICY IF EXISTS "time_slots_tenant_read" ON time_slots;

CREATE POLICY "time_slots_admin_write" ON time_slots
  FOR ALL
  USING (public.rls_check_admin_member(tenant_id))
  WITH CHECK (public.rls_check_admin_member(tenant_id));

CREATE POLICY "time_slots_tenant_read" ON time_slots
  FOR SELECT USING (public.rls_check_tenant_member(tenant_id));

-- ============================================================================
-- 4.92 student_block_sets (student self-access policies with nested subquery)
-- ============================================================================
DROP POLICY IF EXISTS "Students can view their own block sets" ON student_block_sets;
DROP POLICY IF EXISTS "Students can create their own block sets" ON student_block_sets;
DROP POLICY IF EXISTS "Students can update their own block sets" ON student_block_sets;
DROP POLICY IF EXISTS "Students can delete their own block sets" ON student_block_sets;

CREATE POLICY "student_block_sets_student_select" ON student_block_sets
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "student_block_sets_student_insert" ON student_block_sets
  FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "student_block_sets_student_update" ON student_block_sets
  FOR UPDATE USING (student_id = auth.uid());

CREATE POLICY "student_block_sets_student_delete" ON student_block_sets
  FOR DELETE USING (student_id = auth.uid());

-- ============================================================================
-- 4.93 student_career_field_preferences
-- ============================================================================
DROP POLICY IF EXISTS "Students can manage own career field preferences" ON student_career_field_preferences;
DROP POLICY IF EXISTS "Students can view own career field preferences" ON student_career_field_preferences;

CREATE POLICY "career_field_preferences_student" ON student_career_field_preferences
  FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- ============================================================================
-- 4.94 student_notification_preferences
-- ============================================================================
DROP POLICY IF EXISTS "Students can manage own notification preferences" ON student_notification_preferences;
DROP POLICY IF EXISTS "Students can view own notification preferences" ON student_notification_preferences;

CREATE POLICY "notification_preferences_student" ON student_notification_preferences
  FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- ============================================================================
-- STEP 5: Verify — count remaining policies with nested RLS patterns
-- ============================================================================
-- This is a no-op verification query (comment out if not needed):
-- SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public'
--   AND (qual LIKE '%FROM admin_users%' OR qual LIKE '%FROM students%' OR qual LIKE '%FROM parent_student_links%')
--   AND tablename NOT IN ('calendar_events','event_study_data','calendars','calendar_list')
--   ORDER BY tablename, policyname;

COMMIT;
