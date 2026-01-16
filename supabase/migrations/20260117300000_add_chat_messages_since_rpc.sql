-- 점진적 동기화용 RPC 함수
-- 특정 시점 이후의 메시지만 조회하여 재연결 시 효율적으로 동기화

CREATE OR REPLACE FUNCTION get_chat_messages_since(
  p_room_id UUID,
  p_since TIMESTAMP WITH TIME ZONE,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  room_id UUID,
  sender_id UUID,
  sender_type TEXT,
  message_type TEXT,
  content TEXT,
  reply_to_id UUID,
  is_deleted BOOLEAN,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    m.id,
    m.room_id,
    m.sender_id,
    m.sender_type::TEXT,
    m.message_type::TEXT,
    m.content,
    m.reply_to_id,
    m.is_deleted,
    m.deleted_at,
    m.created_at,
    m.updated_at
  FROM chat_messages m
  WHERE m.room_id = p_room_id
    AND m.created_at > p_since
    AND m.is_deleted = false
  ORDER BY m.created_at ASC
  LIMIT p_limit;
$$;

-- 함수에 대한 권한 설정
GRANT EXECUTE ON FUNCTION get_chat_messages_since(UUID, TIMESTAMP WITH TIME ZONE, INT) TO authenticated;

-- 함수에 대한 코멘트 추가
COMMENT ON FUNCTION get_chat_messages_since IS '점진적 동기화: 특정 시점 이후의 채팅 메시지를 조회합니다.';
