-- ============================================================================
-- chat_rooms last_message 역정규화
-- ============================================================================
-- 문제: 채팅방 목록 조회 시 매번 RPC(get_last_messages_by_room_ids)로
--       DISTINCT ON 집계 쿼리 실행 + 별도 sender 정보 조회 필요
-- 해결: chat_rooms에 last_message 컬럼 추가 + INSERT/DELETE 트리거로 자동 갱신
--       → getRoomList에서 RPC + sender 조회 2개 쿼리 제거
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: 컬럼 추가
-- ============================================================================
ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS last_message_content TEXT,
  ADD COLUMN IF NOT EXISTS last_message_type TEXT,
  ADD COLUMN IF NOT EXISTS last_message_sender_name TEXT,
  ADD COLUMN IF NOT EXISTS last_message_sender_id UUID,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

-- ============================================================================
-- STEP 2: 기존 데이터 백필
-- ============================================================================
UPDATE public.chat_rooms cr SET
  last_message_content = sub.content,
  last_message_type = sub.message_type,
  last_message_sender_name = sub.sender_name,
  last_message_sender_id = sub.sender_id,
  last_message_at = sub.created_at
FROM (
  SELECT DISTINCT ON (room_id)
    room_id, content, message_type, sender_name, sender_id, created_at
  FROM public.chat_messages
  WHERE is_deleted = false
  ORDER BY room_id, created_at DESC
) sub
WHERE cr.id = sub.room_id;

-- ============================================================================
-- STEP 3: INSERT 트리거 업데이트 (기존 함수 교체)
-- ============================================================================
-- 기존: updated_at = NOW() 만 갱신
-- 변경: last_message 필드도 함께 갱신
CREATE OR REPLACE FUNCTION public.update_chat_room_on_message()
RETURNS trigger
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.chat_rooms SET
    updated_at = now(),
    last_message_content = LEFT(NEW.content, 100),
    last_message_type = NEW.message_type,
    last_message_sender_name = NEW.sender_name,
    last_message_sender_id = NEW.sender_id,
    last_message_at = NEW.created_at
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: 소프트 삭제 시 last_message 갱신 트리거
-- ============================================================================
-- 마지막 메시지가 삭제되면 이전 메시지로 교체
CREATE OR REPLACE FUNCTION public.update_chat_room_on_message_delete()
RETURNS trigger
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_latest RECORD;
  v_current_last_at TIMESTAMPTZ;
BEGIN
  -- 삭제된 메시지가 마지막 메시지인지 확인
  SELECT last_message_at INTO v_current_last_at
  FROM public.chat_rooms WHERE id = NEW.room_id;

  IF v_current_last_at IS NOT NULL AND OLD.created_at >= v_current_last_at THEN
    -- 이전 메시지 조회
    SELECT content, message_type, sender_name, sender_id, created_at
    INTO v_latest
    FROM public.chat_messages
    WHERE room_id = NEW.room_id AND is_deleted = false
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_latest IS NOT NULL THEN
      UPDATE public.chat_rooms SET
        last_message_content = LEFT(v_latest.content, 100),
        last_message_type = v_latest.message_type,
        last_message_sender_name = v_latest.sender_name,
        last_message_sender_id = v_latest.sender_id,
        last_message_at = v_latest.created_at
      WHERE id = NEW.room_id;
    ELSE
      -- 모든 메시지 삭제됨 → NULL로 초기화
      UPDATE public.chat_rooms SET
        last_message_content = NULL,
        last_message_type = NULL,
        last_message_sender_name = NULL,
        last_message_sender_id = NULL,
        last_message_at = NULL
      WHERE id = NEW.room_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 소프트 삭제 감지 트리거 (is_deleted가 false → true로 변경될 때만)
DROP TRIGGER IF EXISTS trg_chat_message_delete_update_room ON public.chat_messages;
CREATE TRIGGER trg_chat_message_delete_update_room
  AFTER UPDATE OF is_deleted ON public.chat_messages
  FOR EACH ROW
  WHEN (NEW.is_deleted = true AND OLD.is_deleted = false)
  EXECUTE FUNCTION public.update_chat_room_on_message_delete();

COMMIT;
