-- ============================================================
-- 채팅 성능 최적화: auth.uid() initplan 래핑, RLS 인라인,
--                   중복 트리거 제거, 미사용 인덱스 정리
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. SECURITY DEFINER 헬퍼 함수 auth.uid() → (SELECT auth.uid()) 래핑
--
--    함수 내부에서도 auth.uid()를 (SELECT ...) 로 감싸야
--    PostgreSQL이 쿼리당 1회만 평가 (initplan 최적화)
-- ─────────────────────────────────────────────────────────────

-- 0-1. 채팅방 멤버 체크
CREATE OR REPLACE FUNCTION public.rls_check_chat_member(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_room_members
    WHERE room_id = p_room_id
      AND user_id = (SELECT auth.uid())
      AND left_at IS NULL
  );
$$;

-- 0-2. 차단 유저 체크
CREATE OR REPLACE FUNCTION public.rls_check_chat_not_blocked(p_sender_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.chat_blocks
    WHERE blocker_id = (SELECT auth.uid())
      AND blocked_id = p_sender_id
  );
$$;

-- 0-3. 메시지 기준 멤버 체크 (reactions용)
CREATE OR REPLACE FUNCTION public.rls_check_chat_message_member(p_message_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_messages cm
    JOIN public.chat_room_members crm ON crm.room_id = cm.room_id
    WHERE cm.id = p_message_id
      AND crm.user_id = (SELECT auth.uid())
      AND crm.left_at IS NULL
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 1. chat_messages RLS: auth.uid() 래핑 + rls_check_chat_not_blocked 인라인
--
--    기존: rls_check_chat_not_blocked(sender_id) → 행마다 함수 호출
--    변경: NOT IN 서브쿼리 → 쿼리 당 1회 평가 (set-based)
--
--    30개 메시지 로드 시: 함수 30회 → 서브쿼리 1회
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS chat_messages_select ON public.chat_messages;
CREATE POLICY chat_messages_select ON public.chat_messages
  FOR SELECT USING (
    NOT is_deleted
    AND rls_check_chat_member(room_id)
    AND sender_id NOT IN (
      SELECT blocked_id FROM public.chat_blocks
      WHERE blocker_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND public.rls_check_chat_member(room_id)
  );

-- ─────────────────────────────────────────────────────────────
-- 1-2. chat_message_reactions RLS: auth.uid() 래핑
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS reactions_insert_policy ON public.chat_message_reactions;
CREATE POLICY reactions_insert_policy ON public.chat_message_reactions
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.rls_check_chat_message_member(message_id)
  );

-- ─────────────────────────────────────────────────────────────
-- 1-3. chat_attachment_hidden RLS: auth.uid() 래핑
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own hidden attachments" ON public.chat_attachment_hidden;
CREATE POLICY "Users can view own hidden attachments"
  ON public.chat_attachment_hidden FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can hide attachments for themselves" ON public.chat_attachment_hidden;
CREATE POLICY "Users can hide attachments for themselves"
  ON public.chat_attachment_hidden FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can unhide own attachments" ON public.chat_attachment_hidden;
CREATE POLICY "Users can unhide own attachments"
  ON public.chat_attachment_hidden FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 1-4. scheduled_messages RLS: auth.uid() 래핑
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS scheduled_messages_select_own ON public.scheduled_messages;
CREATE POLICY scheduled_messages_select_own
  ON public.scheduled_messages
  FOR SELECT TO authenticated
  USING (sender_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS scheduled_messages_insert_own ON public.scheduled_messages;
CREATE POLICY scheduled_messages_insert_own
  ON public.scheduled_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND public.rls_check_chat_member(room_id)
  );

DROP POLICY IF EXISTS scheduled_messages_update_own ON public.scheduled_messages;
CREATE POLICY scheduled_messages_update_own
  ON public.scheduled_messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = (SELECT auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (
    sender_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS scheduled_messages_delete_own ON public.scheduled_messages;
CREATE POLICY scheduled_messages_delete_own
  ON public.scheduled_messages
  FOR DELETE TO authenticated
  USING (
    sender_id = (SELECT auth.uid())
    AND status IN ('pending', 'failed', 'cancelled')
  );

DROP POLICY IF EXISTS scheduled_messages_select_admin ON public.scheduled_messages;
CREATE POLICY scheduled_messages_select_admin
  ON public.scheduled_messages
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM public.admin_users au WHERE au.id = (SELECT auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. chat_rooms updated_at 트리거 중복 제거
--
--    trg_chat_message_update_room이 이미 updated_at = now()를 설정하므로
--    update_chat_rooms_updated_at 트리거가 같은 값을 다시 설정하는 것은 중복.
--    WHEN 절로 updated_at이 이미 변경된 경우 스킵.
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_chat_rooms_updated_at ON public.chat_rooms;
CREATE TRIGGER update_chat_rooms_updated_at
  BEFORE UPDATE ON public.chat_rooms
  FOR EACH ROW
  WHEN (OLD.updated_at IS NOT DISTINCT FROM NEW.updated_at)
  EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 3. 미사용 인덱스 정리 (idx_scan = 0, 중복)
--
--    school_info_school_code_key (UNIQUE constraint) 와 중복:
--    universities_university_code_key (UNIQUE constraint) 와 중복:
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_school_info_school_code;
DROP INDEX IF EXISTS public.idx_universities_university_code;

-- chat 미사용 인덱스 (전체 기간 idx_scan = 0)
DROP INDEX IF EXISTS public.idx_chat_messages_unread_calc;
DROP INDEX IF EXISTS public.idx_chat_messages_reply_to;
DROP INDEX IF EXISTS public.idx_chat_messages_sender_name;

-- chat_rooms 미사용 인덱스
DROP INDEX IF EXISTS public.idx_chat_rooms_announcement;
DROP INDEX IF EXISTS public.idx_chat_rooms_type_category_active;
DROP INDEX IF EXISTS public.idx_chat_rooms_tenant_id;
DROP INDEX IF EXISTS public.idx_chat_rooms_status;
DROP INDEX IF EXISTS public.idx_chat_rooms_created_by;
DROP INDEX IF EXISTS public.idx_chat_rooms_category;

-- chat_message_reactions 미사용 인덱스 (5개 중 4개 미사용)
DROP INDEX IF EXISTS public.idx_chat_reactions_message_user_emoji;
DROP INDEX IF EXISTS public.idx_reactions_user;
DROP INDEX IF EXISTS public.idx_chat_reactions_user_message;
DROP INDEX IF EXISTS public.idx_chat_reactions_message_emoji;

-- ─────────────────────────────────────────────────────────────
-- 4. P2 마이그레이션: 채팅 RPC 최적화 (RTT 감소)
-- ─────────────────────────────────────────────────────────────

-- P2-1: 1:1 채팅방 탐색 RPC (3 RTT → 1 RTT)
CREATE OR REPLACE FUNCTION find_direct_room_including_left_rpc(
  p_user1_id uuid,
  p_user1_type text,
  p_user2_id uuid,
  p_user2_type text,
  p_category text DEFAULT 'general'
) RETURNS TABLE (
  room_data jsonb,
  user1_left boolean,
  user2_left boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    to_jsonb(r.*) as room_data,
    m1.left_at IS NOT NULL as user1_left,
    m2.left_at IS NOT NULL as user2_left
  FROM chat_rooms r
  JOIN chat_room_members m1
    ON m1.room_id = r.id
    AND m1.user_id = p_user1_id
    AND m1.user_type = p_user1_type
  JOIN chat_room_members m2
    ON m2.room_id = r.id
    AND m2.user_id = p_user2_id
    AND m2.user_type = p_user2_type
  WHERE r.type = 'direct'
    AND r.category = p_category
    AND r.is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION find_direct_room_including_left_rpc IS
  '두 사용자 간 1:1 채팅방을 단일 JOIN으로 조회 (나간 멤버 포함). 3 RTT → 1 RTT 최적화.';

-- P2-2: 학부모 접근 가능 관리자 조회 RPC (2 RTT → 1 RTT)
CREATE OR REPLACE FUNCTION get_parent_accessible_admins()
RETURNS TABLE (
  id uuid,
  role text,
  name text,
  profile_image_url text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT
    au.id,
    au.role::text,
    up.name,
    up.profile_image_url
  FROM parent_student_links psl
  JOIN students s ON s.id = psl.student_id
  JOIN admin_users au ON au.tenant_id = s.tenant_id
  JOIN user_profiles up ON up.id = au.id
  WHERE psl.parent_id = (SELECT auth.uid())
    AND au.role IN ('admin', 'consultant')
  ORDER BY up.name;
$$;

COMMENT ON FUNCTION get_parent_accessible_admins IS
  '현재 인증된 학부모의 자녀 tenant에 속한 관리자/상담사 목록 조회. 2 RTT → 1 RTT 최적화.';
