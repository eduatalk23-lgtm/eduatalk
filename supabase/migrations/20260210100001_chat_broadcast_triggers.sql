-- Migration: postgres_changes → broadcast 마이그레이션
--
-- chat 테이블들에 realtime.broadcast_changes 트리거를 추가하여
-- postgres_changes (WAL 파싱) 대신 broadcast를 사용합니다.
-- 이를 통해 서버 부하 감소 + 지연 시간 개선을 달성합니다.

-- ============================================================
-- 1. chat_messages: INSERT / UPDATE
--    이벤트: INSERT, UPDATE (soft delete이므로 DELETE 불필요)
--    토픽: chat-room-{room_id}
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_chat_message_changes()
RETURNS trigger
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'chat-room-' || NEW.room_id::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broadcast_chat_messages
  AFTER INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_chat_message_changes();

-- ============================================================
-- 2. chat_message_reactions: INSERT / DELETE
--    room_id가 없으므로 chat_messages에서 조회
--    이벤트: REACTION_INSERT, REACTION_DELETE
--    토픽: chat-room-{room_id}
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_chat_reaction_changes()
RETURNS trigger
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_room_id uuid;
  v_record record;
BEGIN
  -- INSERT: NEW 사용, DELETE: OLD 사용
  IF TG_OP = 'DELETE' THEN
    v_record := OLD;
  ELSE
    v_record := NEW;
  END IF;

  -- message_id로 room_id 조회
  SELECT room_id INTO v_room_id
  FROM public.chat_messages
  WHERE id = v_record.message_id;

  IF v_room_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM realtime.broadcast_changes(
    'chat-room-' || v_room_id::text,
    'REACTION_' || TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broadcast_chat_reactions
  AFTER INSERT OR DELETE ON public.chat_message_reactions
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_chat_reaction_changes();

-- ============================================================
-- 3. chat_pinned_messages: INSERT / DELETE
--    이벤트: PIN_INSERT, PIN_DELETE
--    토픽: chat-room-{room_id}
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_chat_pinned_changes()
RETURNS trigger
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_record record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record := OLD;
  ELSE
    v_record := NEW;
  END IF;

  PERFORM realtime.broadcast_changes(
    'chat-room-' || v_record.room_id::text,
    'PIN_' || TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broadcast_chat_pinned
  AFTER INSERT OR DELETE ON public.chat_pinned_messages
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_chat_pinned_changes();

-- ============================================================
-- 4. chat_rooms: UPDATE
--    이벤트: ROOM_UPDATE
--    토픽: chat-room-{id} (chat_rooms.id가 room_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_chat_room_changes()
RETURNS trigger
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'chat-room-' || NEW.id::text,
    'ROOM_UPDATE',
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broadcast_chat_rooms
  AFTER UPDATE ON public.chat_rooms
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_chat_room_changes();

-- ============================================================
-- 5. chat_room_members: UPDATE
--    이벤트: MEMBER_UPDATE
--    토픽: chat-room-{room_id}
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_chat_member_changes()
RETURNS trigger
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'chat-room-' || NEW.room_id::text,
    'MEMBER_UPDATE',
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broadcast_chat_members
  AFTER UPDATE ON public.chat_room_members
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_chat_member_changes();
