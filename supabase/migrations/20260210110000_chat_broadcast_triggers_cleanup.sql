-- Migration: Chat broadcast 트리거 정리 + 최적화
--
-- 1. chat_messages 중복 트리거 제거
-- 2. chat_room_members 트리거에 컬럼 필터 추가 (markAsRead 노이즈 제거)
-- 3. chat_rooms 트리거에 컬럼 필터 추가 (updated_at 노이즈 제거)
-- 4. broadcast로 전환 완료된 테이블을 Realtime publication에서 제거

-- ============================================================
-- 1. chat_messages 중복 트리거 제거
--    broadcast_chat_messages (마이그레이션)과 chat_messages_broadcast_trigger (수동 생성 잔재)가
--    동일한 broadcast_chat_message_changes() 함수를 호출하여 메시지마다 2x broadcast 발생
-- ============================================================
DROP TRIGGER IF EXISTS chat_messages_broadcast_trigger ON public.chat_messages;

-- ============================================================
-- 2. chat_room_members: left_at 변경 시에만 broadcast
--    markAsRead (last_read_at UPDATE)는 매우 빈번하지만 클라이언트에서 무시됨.
--    불필요한 broadcast 트래픽 제거.
-- ============================================================
DROP TRIGGER IF EXISTS broadcast_chat_members ON public.chat_room_members;

CREATE TRIGGER broadcast_chat_members
  AFTER UPDATE OF left_at ON public.chat_room_members
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_chat_member_changes();

-- ============================================================
-- 3. chat_rooms: 의미 있는 컬럼 변경 시에만 broadcast
--    새 메시지 → trg_chat_message_update_room → chat_rooms.updated_at UPDATE
--    → broadcast_chat_rooms 발화 → 클라이언트에서 announcement_at만 확인 후 무시
--    updated_at 변경을 제외하고 실제 의미 있는 컬럼만 감시
-- ============================================================
DROP TRIGGER IF EXISTS broadcast_chat_rooms ON public.chat_rooms;

CREATE TRIGGER broadcast_chat_rooms
  AFTER UPDATE OF announcement_at, announcement, announcement_by, announcement_by_type, name, is_active
  ON public.chat_rooms
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_chat_room_changes();

-- ============================================================
-- 4. Realtime publication에서 broadcast 전환 완료 테이블 제거
--    useChatRealtime이 더 이상 postgres_changes를 사용하지 않으므로
--    WAL 파싱 오버헤드를 줄이기 위해 제거.
--    유지: chat_rooms, chat_room_members (useChatRoomListRealtime에서 postgres_changes 사용)
-- ============================================================
ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_message_reactions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_pinned_messages;
