-- Message Read Counts RPC
-- 메시지별 읽지 않은 멤버 수 계산 (읽음 표시 기능)

-- ============================================
-- 메시지별 읽지 않은 멤버 수 집계
-- ============================================
-- 발신자의 메시지에 대해 아직 읽지 않은 멤버 수를 계산합니다.
-- 채팅 UI에서 "읽음 N" 표시에 사용됩니다.

CREATE OR REPLACE FUNCTION get_message_read_counts(
  p_room_id uuid,
  p_message_ids uuid[],
  p_sender_id uuid
)
RETURNS TABLE (
  message_id uuid,
  unread_count bigint
) AS $$
  WITH message_times AS (
    -- 요청된 메시지들의 생성 시간 조회
    SELECT id, created_at
    FROM chat_messages
    WHERE id = ANY(p_message_ids)
      AND sender_id = p_sender_id  -- 발신자 본인 메시지만
      AND room_id = p_room_id
  ),
  active_members AS (
    -- 활성 멤버 (발신자 제외)
    SELECT user_id, last_read_at
    FROM chat_room_members
    WHERE room_id = p_room_id
      AND left_at IS NULL
      AND user_id != p_sender_id
  )
  SELECT
    mt.id AS message_id,
    COUNT(am.user_id)::bigint AS unread_count
  FROM message_times mt
  CROSS JOIN active_members am
  WHERE am.last_read_at < mt.created_at
  GROUP BY mt.id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_message_read_counts(uuid, uuid[], uuid) IS
  '메시지별 읽지 않은 멤버 수를 집계합니다. 발신자의 메시지에 대해서만 동작하며, "읽음 N" 표시에 사용됩니다.';

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_message_read_counts(uuid, uuid[], uuid) TO authenticated;
