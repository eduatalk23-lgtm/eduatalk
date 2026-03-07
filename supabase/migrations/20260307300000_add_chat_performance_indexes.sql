-- Chat Performance Indexes
-- 쿼리 패턴 분석 기반 누락 인덱스 추가

-- 1. 메시지 목록 조회 (가장 빈번한 쿼리)
-- 사용처: findMessagesByRoom(), searchMessagesByRoom(), getMessagesSince()
-- 패턴: WHERE room_id = ? AND is_deleted = false ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_deleted_created
  ON chat_messages(room_id, is_deleted, created_at DESC);

-- 2. 멤버 조회 (권한 체크, 읽음 확인 등)
-- 사용처: findMember(), findDirectRoom(), findDirectRoomIncludingLeft()
-- 패턴: WHERE room_id = ? AND user_id = ? AND user_type = ?
CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_user_type
  ON chat_room_members(room_id, user_id, user_type);

-- 3. 리액션 토글 (UI 인터랙션)
-- 사용처: hasReaction(), deleteReaction()
-- 패턴: WHERE message_id = ? AND user_id = ? AND user_type = ? AND emoji = ?
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message_user_emoji
  ON chat_message_reactions(message_id, user_id, user_type, emoji);

-- 4. 활성 멤버 목록 (방 정보 표시)
-- 사용처: findMembersByRoom(), countActiveMembers()
-- 패턴: WHERE room_id = ? AND left_at IS NULL AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_active
  ON chat_room_members(room_id)
  WHERE left_at IS NULL AND deleted_at IS NULL;
