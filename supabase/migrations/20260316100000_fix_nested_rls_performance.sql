-- ============================================================================
-- Fix Nested RLS Performance
-- ============================================================================
-- Problem: RLS policies on event_study_data, calendar_events, calendars,
--          calendar_list reference other RLS-protected tables (admin_users,
--          calendar_events, calendars), creating 3-level nested RLS evaluation
--          chains that cause statement timeouts even with ~240 rows.
--
-- Solution: SECURITY DEFINER helper functions that bypass nested RLS while
--           enforcing the same access rules. These functions run as the
--           function owner (postgres), so subqueries skip RLS evaluation.
--
-- Affected tables: calendar_events, event_study_data, calendars, calendar_list
-- ============================================================================

-- ============================================================================
-- Step 1: Create SECURITY DEFINER helper functions
-- ============================================================================

-- 1-1. Admin tenant check
-- Replaces: EXISTS(SELECT 1 FROM admin_users WHERE id = auth.uid() AND tenant_id = X AND role IN (...))
-- Used by: calendar_events, calendars, and indirectly by calendar_list
CREATE OR REPLACE FUNCTION public.rls_check_admin_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid()
      AND tenant_id = p_tenant_id
      AND role IN ('admin', 'consultant')
  );
$$;

-- 1-2. Parent-student link check
-- Replaces nested: EXISTS(SELECT 1 FROM parent_student_links WHERE parent_id = auth.uid() AND student_id = X)
-- Used by: calendars parent policy, calendar_events parent policy
CREATE OR REPLACE FUNCTION public.rls_check_parent_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_student_links
    WHERE parent_id = auth.uid()
      AND student_id = p_student_id
  );
$$;

-- 1-3. Calendar parent check (calendar_id -> calendars -> parent_student_links)
-- Replaces: EXISTS(SELECT 1 FROM calendars c JOIN parent_student_links psl ON ... WHERE c.id = X AND ...)
-- Used by: calendar_events parent policy
CREATE OR REPLACE FUNCTION public.rls_check_calendar_parent(p_calendar_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendars c
    JOIN public.parent_student_links psl ON psl.student_id = c.owner_id
    WHERE c.id = p_calendar_id
      AND c.owner_type = 'student'
      AND psl.parent_id = auth.uid()
  );
$$;

-- 1-4. Event student check (event_id -> calendar_events.student_id)
-- Replaces: EXISTS(SELECT 1 FROM calendar_events WHERE id = X AND student_id = auth.uid())
-- Used by: event_study_data student policy
CREATE OR REPLACE FUNCTION public.rls_check_event_student(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendar_events
    WHERE id = p_event_id
      AND student_id = auth.uid()
  );
$$;

-- 1-5. Event admin check (event_id -> calendar_events.tenant_id -> admin_users)
-- Replaces: EXISTS(SELECT 1 FROM calendar_events JOIN admin_users ON ... WHERE calendar_events.id = X AND ...)
-- Used by: event_study_data admin policy
CREATE OR REPLACE FUNCTION public.rls_check_event_admin(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendar_events ce
    JOIN public.admin_users au ON au.tenant_id = ce.tenant_id
    WHERE ce.id = p_event_id
      AND au.id = auth.uid()
      AND au.role IN ('admin', 'consultant')
  );
$$;

-- 1-6. Calendar admin check (calendar_id -> calendars.tenant_id -> admin_users)
-- Replaces: EXISTS(SELECT 1 FROM admin_users WHERE id = auth.uid() AND tenant_id = (SELECT tenant_id FROM calendars WHERE id = X))
-- Used by: calendar_list admin policy
CREATE OR REPLACE FUNCTION public.rls_check_calendar_admin(p_calendar_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendars c
    JOIN public.admin_users au ON au.tenant_id = c.tenant_id
    WHERE c.id = p_calendar_id
      AND au.id = auth.uid()
      AND au.role IN ('admin', 'consultant')
  );
$$;


-- ============================================================================
-- Step 2: Replace RLS policies (order: calendars -> calendar_events -> event_study_data -> calendar_list)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2-1. calendars
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "calendars_admin_all" ON calendars;
DROP POLICY IF EXISTS "calendars_student_select" ON calendars;
DROP POLICY IF EXISTS "calendars_parent_select" ON calendars;

CREATE POLICY "calendars_admin_all" ON calendars
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "calendars_student_select" ON calendars
  FOR SELECT
  USING (owner_id = auth.uid() AND owner_type = 'student');

CREATE POLICY "calendars_parent_select" ON calendars
  FOR SELECT
  USING (
    owner_type = 'student'
    AND public.rls_check_parent_student(owner_id)
  );

-- ----------------------------------------------------------------------------
-- 2-2. calendar_events
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "calendar_events_admin_all" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_student_all" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_parent_select" ON calendar_events;

CREATE POLICY "calendar_events_admin_all" ON calendar_events
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "calendar_events_student_all" ON calendar_events
  FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "calendar_events_parent_select" ON calendar_events
  FOR SELECT
  USING (public.rls_check_calendar_parent(calendar_id));

-- ----------------------------------------------------------------------------
-- 2-3. event_study_data
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "event_study_data_admin_all" ON event_study_data;
DROP POLICY IF EXISTS "event_study_data_student_select" ON event_study_data;

CREATE POLICY "event_study_data_admin_all" ON event_study_data
  FOR ALL
  USING (public.rls_check_event_admin(event_id))
  WITH CHECK (public.rls_check_event_admin(event_id));

CREATE POLICY "event_study_data_student_select" ON event_study_data
  FOR SELECT
  USING (public.rls_check_event_student(event_id));

-- ----------------------------------------------------------------------------
-- 2-4. calendar_list
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "calendar_list_admin_all" ON calendar_list;
-- calendar_list_owner_all stays as-is (simple auth.uid() = user_id check)

CREATE POLICY "calendar_list_admin_all" ON calendar_list
  FOR ALL
  USING (public.rls_check_calendar_admin(calendar_id))
  WITH CHECK (public.rls_check_calendar_admin(calendar_id));


-- ============================================================================
-- Step 3: Add covering index for admin RLS checks
-- ============================================================================
-- The existing idx_admin_users_member_check (id, tenant_id) already covers the
-- general case; this partial index filtered by role makes admin checks even faster.
CREATE INDEX IF NOT EXISTS idx_admin_users_admin_check
  ON admin_users (id, tenant_id)
  WHERE role IN ('admin', 'consultant');


-- ============================================================================
-- Step 4: Grant execute to authenticated role
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.rls_check_admin_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_parent_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_calendar_parent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_event_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_event_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_calendar_admin(uuid) TO authenticated;
