-- ============================================
-- 채팅 메시지 성능 인덱스 추가
-- ============================================

-- reply_to_id 인덱스 (답장 원본 메시지 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to_id
  ON chat_messages(reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- room_id + is_deleted + created_at 복합 인덱스 (메시지 목록 조회 최적화)
-- 기존 idx_chat_messages_room_created_desc보다 더 효율적
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_active_created
  ON chat_messages(room_id, is_deleted, created_at DESC);

-- sender_id + sender_type 인덱스 (발신자별 메시지 조회)
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
  ON chat_messages(sender_id, sender_type);

-- 리액션 테이블: message_id + emoji 인덱스 (리액션 카운트 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message_emoji
  ON chat_message_reactions(message_id, emoji);

-- 리액션 테이블: user_id + message_id 인덱스 (사용자별 리액션 확인)
CREATE INDEX IF NOT EXISTS idx_chat_reactions_user_message
  ON chat_message_reactions(user_id, message_id);

-- 채팅방 멤버: user_id + left_at 인덱스 (활성 멤버 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_active
  ON chat_room_members(user_id, user_type)
  WHERE left_at IS NULL;

-- 읽음 표시용 인덱스: room_id + last_read_at (안 읽은 메시지 카운트)
CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_read
  ON chat_room_members(room_id, last_read_at);
