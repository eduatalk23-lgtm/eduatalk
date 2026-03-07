-- Migration: room list 채널의 postgres_changes → broadcast 전환
-- 유저별 chat-rooms-{userId} 토픽으로 broadcast하여
-- postgres_changes 구독(WAL 파싱) 제거 → DB 커넥션 풀 부하 해소
--
-- 주의: chat-rooms-{userId} 채널은 public 구독이므로
-- realtime.send에 private := false를 명시해야 전달됩니다.
-- (realtime.broadcast_changes는 private=true가 기본값이라 public 구독자에게 전달 안 됨)

-- ============================================================
-- 1. chat_room_members INSERT/UPDATE → 해당 유저의 room list 토픽
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_room_list_member_changes()
RETURNS trigger
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'old_record', to_jsonb(OLD),
    'record', to_jsonb(NEW),
    'operation', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA
  );

  PERFORM realtime.send(
    v_payload,
    TG_OP,
    'chat-rooms-' || NEW.user_id::text,
    false  -- public channel
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broadcast_room_list_members
  AFTER INSERT OR UPDATE ON public.chat_room_members
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_room_list_member_changes();

-- ============================================================
-- 2. chat_rooms UPDATE → 해당 방의 모든 활성 멤버에게 broadcast
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_room_list_room_changes()
RETURNS trigger
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'old_record', to_jsonb(OLD),
    'record', to_jsonb(NEW),
    'operation', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA
  );

  FOR v_user_id IN
    SELECT user_id FROM public.chat_room_members
    WHERE room_id = NEW.id
      AND left_at IS NULL
      AND deleted_at IS NULL
  LOOP
    PERFORM realtime.send(
      v_payload,
      'ROOM_UPDATE',
      'chat-rooms-' || v_user_id::text,
      false  -- public channel
    );
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broadcast_room_list_rooms
  AFTER UPDATE ON public.chat_rooms
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_room_list_room_changes();
