-- ============================================================================
-- Chat RLS Performance: SECURITY DEFINER 함수로 전환 + WAL Publication 정리
-- ============================================================================
-- 문제: chat_messages SELECT RLS가 행마다 2× EXISTS 서브쿼리 실행
--       50개 메시지 조회 시 100번 서브쿼리 → 데이터 증가 시 선형 성능 저하
-- 해결: SECURITY DEFINER 함수로 래핑 → room_id 기준 캐싱, 행별 반복 제거
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: SECURITY DEFINER 헬퍼 함수 생성
-- ============================================================================

-- 1-1. 채팅방 멤버 체크 (room_id 기준 → 같은 room_id 쿼리 내 1회만 평가)
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
      AND user_id = auth.uid()
      AND left_at IS NULL
  );
$$;

-- 1-2. 차단 유저 체크 (sender_id 기준 → distinct sender별 1회 평가)
CREATE OR REPLACE FUNCTION public.rls_check_chat_not_blocked(p_sender_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.chat_blocks
    WHERE blocker_id = auth.uid()
      AND blocked_id = p_sender_id
  );
$$;

-- 1-3. 메시지 기준 멤버 체크 (reactions용 — message_id → room_id 조회 포함)
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
      AND crm.user_id = auth.uid()
      AND crm.left_at IS NULL
  );
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION public.rls_check_chat_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_chat_not_blocked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_chat_message_member(uuid) TO authenticated;

-- ============================================================================
-- STEP 2: chat_messages RLS 정책 교체
-- ============================================================================

-- SELECT: 행마다 2× EXISTS → SECURITY DEFINER 함수 호출로 전환
DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
CREATE POLICY "chat_messages_select" ON public.chat_messages
  FOR SELECT
  USING (
    NOT is_deleted
    AND public.rls_check_chat_member(room_id)
    AND public.rls_check_chat_not_blocked(sender_id)
  );

-- INSERT: 기존 정책도 SECURITY DEFINER 함수로 통일
DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_insert" ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND public.rls_check_chat_member(room_id)
  );

-- UPDATE: rls_check_chat_room_admin은 이미 SECURITY DEFINER, 유지
-- (변경 없음)

-- ============================================================================
-- STEP 3: chat_message_reactions RLS 정책 교체
-- ============================================================================

-- SELECT: JOIN 서브쿼리 → SECURITY DEFINER 함수
DROP POLICY IF EXISTS "reactions_select_policy" ON public.chat_message_reactions;
CREATE POLICY "reactions_select_policy" ON public.chat_message_reactions
  FOR SELECT
  USING (public.rls_check_chat_message_member(message_id));

-- INSERT: JOIN 서브쿼리 → SECURITY DEFINER 함수
DROP POLICY IF EXISTS "reactions_insert_policy" ON public.chat_message_reactions;
CREATE POLICY "reactions_insert_policy" ON public.chat_message_reactions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.rls_check_chat_message_member(message_id)
  );

-- DELETE: 기존 단순 정책 유지 (user_id = auth.uid() — 이미 최적)

-- ============================================================================
-- STEP 4: WAL Publication 정리
-- ============================================================================
-- chat_rooms, chat_room_members는 broadcast 트리거로 전환 완료
-- postgres_changes 구독 없음 확인 (grep 검증 완료)
-- WAL 파싱 오버헤드 제거

ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.chat_rooms;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.chat_room_members;

COMMIT;
