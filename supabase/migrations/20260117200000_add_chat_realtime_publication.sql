-- ============================================
-- 채팅 테이블 Realtime Publication 활성화
-- ============================================
-- Supabase Realtime이 테이블 변경사항을 브로드캐스트하려면
-- 해당 테이블이 supabase_realtime publication에 등록되어야 합니다.

-- 기존에 이미 등록되어 있을 수 있으므로 안전하게 처리
DO $$
BEGIN
  -- chat_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;

  -- chat_message_reactions
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_reactions;
  END IF;

  -- chat_pinned_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_pinned_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_pinned_messages;
  END IF;

  -- chat_rooms
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_rooms;
  END IF;

  -- chat_room_members
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_room_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_room_members;
  END IF;
END $$;

-- ============================================
-- 검증 쿼리 (마이그레이션 후 실행 확인용)
-- ============================================
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
