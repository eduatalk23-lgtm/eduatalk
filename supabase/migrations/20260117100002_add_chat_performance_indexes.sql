-- Chat Performance Optimization: Indexes
-- 채팅 성능 최적화를 위한 인덱스 추가

-- ============================================
-- 1. 채팅방 멤버 조회 최적화 인덱스
-- ============================================
-- 사용자별 활성 채팅방 목록 조회 최적화
-- findRoomsByUser, findMember 등에서 사용
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_room
  ON chat_room_members(user_id, user_type, room_id)
  WHERE left_at IS NULL;

COMMENT ON INDEX idx_chat_room_members_user_room IS
  '사용자별 활성 채팅방 멤버십 조회 최적화. left_at IS NULL 조건으로 활성 멤버만 포함.';


-- ============================================
-- 2. 읽지 않은 메시지 계산 최적화 인덱스
-- ============================================
-- countUnreadByRoomIds RPC에서 사용
-- room_id별로 sender_id와 created_at으로 필터링
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread_calc
  ON chat_messages(room_id, sender_id, created_at)
  WHERE is_deleted = false;

COMMENT ON INDEX idx_chat_messages_unread_calc IS
  '읽지 않은 메시지 수 계산 최적화. room_id, sender_id, created_at 조합으로 빠른 집계 가능.';


-- ============================================
-- 3. 활성 채팅방 멤버 조회 최적화 인덱스
-- ============================================
-- findMembersByRoom, findMembersByRoomIds에서 사용
CREATE INDEX IF NOT EXISTS idx_chat_room_members_active_room
  ON chat_room_members(room_id)
  WHERE left_at IS NULL;

COMMENT ON INDEX idx_chat_room_members_active_room IS
  '채팅방별 활성 멤버 조회 최적화. room_id로 빠른 조회.';


-- ============================================
-- 4. 마지막 메시지 조회 최적화 인덱스
-- ============================================
-- get_last_messages_by_room_ids RPC에서 DISTINCT ON 최적화
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created_desc
  ON chat_messages(room_id, created_at DESC)
  WHERE is_deleted = false;

COMMENT ON INDEX idx_chat_messages_room_created_desc IS
  '채팅방별 마지막 메시지 조회 최적화. DISTINCT ON 쿼리에서 효율적인 인덱스 스캔 가능.';


-- ============================================
-- 5. 리액션 조회 최적화 인덱스 (메시지별)
-- ============================================
-- findReactionsByMessageIds에서 사용
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message_id
  ON chat_message_reactions(message_id);

COMMENT ON INDEX idx_chat_reactions_message_id IS
  '메시지별 리액션 배치 조회 최적화.';


-- ============================================
-- 6. 메시지 검색 최적화 인덱스 (ILIKE용 pg_trgm)
-- ============================================
-- searchMessagesByRoom에서 ILIKE 검색 최적화
-- pg_trgm 확장이 설치되어 있어야 함
DO $$
BEGIN
  -- pg_trgm 확장이 있는지 확인
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) THEN
    -- GIN 인덱스 생성 (이미 존재하면 건너뜀)
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE indexname = 'idx_chat_messages_content_trgm'
    ) THEN
      CREATE INDEX idx_chat_messages_content_trgm
        ON chat_messages USING gin(content gin_trgm_ops);
    END IF;
  END IF;
END $$;
