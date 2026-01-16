-- 채팅 메시지 리액션 테이블
-- 메시지에 이모지 리액션 추가 기능

-- 리액션 테이블 생성
CREATE TABLE IF NOT EXISTS chat_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('student', 'admin')),
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  -- 같은 사용자가 같은 메시지에 같은 이모지 중복 방지
  UNIQUE(message_id, user_id, user_type, emoji)
);

-- RLS 활성화
ALTER TABLE chat_message_reactions ENABLE ROW LEVEL SECURITY;

-- 조회 정책: 채팅방 멤버만 리액션 조회 가능
CREATE POLICY "reactions_select_policy" ON chat_message_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_messages cm
      JOIN chat_room_members crm ON crm.room_id = cm.room_id
      WHERE cm.id = chat_message_reactions.message_id
      AND crm.user_id = auth.uid()
      AND crm.left_at IS NULL
    )
  );

-- 추가 정책: 본인만 리액션 추가 가능
CREATE POLICY "reactions_insert_policy" ON chat_message_reactions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_messages cm
      JOIN chat_room_members crm ON crm.room_id = cm.room_id
      WHERE cm.id = chat_message_reactions.message_id
      AND crm.user_id = auth.uid()
      AND crm.left_at IS NULL
    )
  );

-- 삭제 정책: 본인 리액션만 삭제 가능
CREATE POLICY "reactions_delete_policy" ON chat_message_reactions
  FOR DELETE
  USING (user_id = auth.uid());

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON chat_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON chat_message_reactions(user_id, user_type);

-- 코멘트
COMMENT ON TABLE chat_message_reactions IS '채팅 메시지 이모지 리액션';
COMMENT ON COLUMN chat_message_reactions.emoji IS '리액션 이모지 (👍, ❤️, 😂, 🔥, 😮)';
