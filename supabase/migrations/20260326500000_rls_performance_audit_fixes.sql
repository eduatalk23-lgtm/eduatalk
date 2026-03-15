-- ============================================================================
-- RLS 성능 감사 결과 수정 마이그레이션
-- 1) 누락 인덱스 9개 추가
-- 2) IN → EXISTS 변환 (payment_links, scheduled_messages, chat_messages)
-- 3) 중복 RLS 정책 19개 제거
-- ============================================================================

-- ============================================================================
-- PART 1: 누락 인덱스 추가 (RLS에서 사용되는 컬럼)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_id
  ON public.calendar_events(tenant_id);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_tenant_id
  ON public.chat_rooms(tenant_id);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by
  ON public.chat_rooms(created_by);

CREATE INDEX IF NOT EXISTS idx_daily_check_ins_tenant_id
  ON public.daily_check_ins(tenant_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_tenant_id
  ON public.scheduled_messages(tenant_id);

CREATE INDEX IF NOT EXISTS idx_camp_invitations_tenant_id
  ON public.camp_invitations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_attendance_record_history_tenant_id
  ON public.attendance_record_history(tenant_id);

CREATE INDEX IF NOT EXISTS idx_plan_views_tenant_id
  ON public.plan_views(tenant_id);

CREATE INDEX IF NOT EXISTS idx_student_score_events_student_id
  ON public.student_score_events(student_id);


-- ============================================================================
-- PART 2: IN → EXISTS 변환 (옵티마이저가 더 효율적으로 처리)
-- ============================================================================

-- payment_links: SELECT (IN → EXISTS)
DROP POLICY IF EXISTS "admin_payment_links_select" ON public.payment_links;
CREATE POLICY "admin_payment_links_select" ON public.payment_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.id = (SELECT auth.uid())
        AND admin_users.tenant_id = payment_links.tenant_id
    )
  );

-- payment_links: UPDATE (IN → EXISTS)
DROP POLICY IF EXISTS "admin_payment_links_update" ON public.payment_links;
CREATE POLICY "admin_payment_links_update" ON public.payment_links
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.id = (SELECT auth.uid())
        AND admin_users.tenant_id = payment_links.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.id = (SELECT auth.uid())
        AND admin_users.tenant_id = payment_links.tenant_id
    )
  );

-- payment_links: DELETE (IN → EXISTS)
DROP POLICY IF EXISTS "admin_payment_links_delete" ON public.payment_links;
CREATE POLICY "admin_payment_links_delete" ON public.payment_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.id = (SELECT auth.uid())
        AND admin_users.tenant_id = payment_links.tenant_id
    )
  );

-- scheduled_messages: admin SELECT (IN → EXISTS)
DROP POLICY IF EXISTS "scheduled_messages_select_admin" ON public.scheduled_messages;
CREATE POLICY "scheduled_messages_select_admin" ON public.scheduled_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = (SELECT auth.uid())
        AND au.tenant_id = scheduled_messages.tenant_id
    )
  );

-- chat_messages: SELECT (NOT IN → NOT EXISTS, 행마다 서브쿼리 제거)
DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
CREATE POLICY "chat_messages_select" ON public.chat_messages
  FOR SELECT USING (
    (NOT is_deleted)
    AND rls_check_chat_member(room_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.chat_blocks
      WHERE chat_blocks.blocker_id = (SELECT auth.uid())
        AND chat_blocks.blocked_id = chat_messages.sender_id
    )
  );


-- ============================================================================
-- PART 3: 중복 RLS 정책 제거 (19개)
-- PERMISSIVE 정책은 OR로 평가되므로 중복 시 불필요한 연산 발생
-- ============================================================================

-- ---------------------------------------------------------------------------
-- flexible_contents: SELECT 3개 → 1개 (student_select이 NULL 포함하여 가장 넓음)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "flexible_contents_student_read" ON public.flexible_contents;
DROP POLICY IF EXISTS "학생은 본인 flexible_contents 조회 가능" ON public.flexible_contents;

-- ---------------------------------------------------------------------------
-- student_block_schedule: ALL 1개가 모든 CRUD 커버 → 개별 7개 제거
-- 유지: "Users can manage own schedule" (ALL, student_id = auth.uid())
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can delete their own block schedules" ON public.student_block_schedule;
DROP POLICY IF EXISTS "delete own block" ON public.student_block_schedule;
DROP POLICY IF EXISTS "Students can insert their own block schedules" ON public.student_block_schedule;
DROP POLICY IF EXISTS "insert own block" ON public.student_block_schedule;
DROP POLICY IF EXISTS "Students can view their own block schedules" ON public.student_block_schedule;
DROP POLICY IF EXISTS "select own block" ON public.student_block_schedule;
DROP POLICY IF EXISTS "Students can update their own block schedules" ON public.student_block_schedule;

-- ---------------------------------------------------------------------------
-- student_custom_contents: ALL 1개가 모든 CRUD 커버 → 개별 6개 제거
-- 유지: "Users can manage own custom contents" (ALL, student_id = auth.uid())
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can delete their own custom contents" ON public.student_custom_contents;
DROP POLICY IF EXISTS "Students can insert their own custom contents" ON public.student_custom_contents;
DROP POLICY IF EXISTS "insert own custom contents" ON public.student_custom_contents;
DROP POLICY IF EXISTS "Students can view their own custom contents" ON public.student_custom_contents;
DROP POLICY IF EXISTS "select own custom contents" ON public.student_custom_contents;
DROP POLICY IF EXISTS "Students can update their own custom contents" ON public.student_custom_contents;

-- ---------------------------------------------------------------------------
-- student_analysis: SELECT 3개 → 2개 (중복 1개 제거)
-- 유지: "Students can view their own analysis" + "student_analysis_admin_select"
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own analysis" ON public.student_analysis;

-- ---------------------------------------------------------------------------
-- plan_groups: ALL 3개 → 1개 (multi_access가 student+admin+parent 모두 커버)
-- 유지: "plan_groups_multi_access"
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "plan_groups_admin_all" ON public.plan_groups;
DROP POLICY IF EXISTS "plan_groups_student_all" ON public.plan_groups;

-- ---------------------------------------------------------------------------
-- calendars: ALL 2개 → 1개 (admin_all이 tenant_admin_all의 상위집합)
-- 유지: "calendars_admin_all"
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "calendars_tenant_admin_all" ON public.calendars;
