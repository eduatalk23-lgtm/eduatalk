-- ============================================
-- Phase 4.3: 채팅방 공지 (Announcement)
-- ============================================

-- chat_rooms 테이블에 공지 관련 컬럼 추가
ALTER TABLE chat_rooms
ADD COLUMN IF NOT EXISTS announcement text,
ADD COLUMN IF NOT EXISTS announcement_by uuid,
ADD COLUMN IF NOT EXISTS announcement_by_type text CHECK (announcement_by_type IS NULL OR announcement_by_type IN ('student', 'admin')),
ADD COLUMN IF NOT EXISTS announcement_at timestamptz;

-- 인덱스: 공지가 있는 채팅방 빠른 조회
CREATE INDEX IF NOT EXISTS idx_chat_rooms_announcement
ON chat_rooms(id) WHERE announcement IS NOT NULL;

-- 코멘트 추가
COMMENT ON COLUMN chat_rooms.announcement IS '채팅방 공지 내용';
COMMENT ON COLUMN chat_rooms.announcement_by IS '공지 작성자 ID';
COMMENT ON COLUMN chat_rooms.announcement_by_type IS '공지 작성자 유형 (student/admin)';
COMMENT ON COLUMN chat_rooms.announcement_at IS '공지 작성 시간';
