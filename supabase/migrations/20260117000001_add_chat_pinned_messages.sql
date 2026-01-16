-- 채팅방 메시지 고정 테이블
CREATE TABLE IF NOT EXISTS chat_pinned_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  pinned_by uuid NOT NULL,
  pinned_by_type text NOT NULL CHECK (pinned_by_type IN ('student', 'admin')),
  pin_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(room_id, message_id)
);

-- RLS 활성화
ALTER TABLE chat_pinned_messages ENABLE ROW LEVEL SECURITY;

-- 조회 정책: 채팅방 멤버만
CREATE POLICY "pinned_select_policy" ON chat_pinned_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_room_members crm
      WHERE crm.room_id = chat_pinned_messages.room_id
      AND crm.user_id = auth.uid()
      AND crm.left_at IS NULL
    )
  );

-- 추가 정책: owner 또는 admin 역할만
CREATE POLICY "pinned_insert_policy" ON chat_pinned_messages
  FOR INSERT
  WITH CHECK (
    pinned_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_room_members crm
      WHERE crm.room_id = chat_pinned_messages.room_id
      AND crm.user_id = auth.uid()
      AND crm.role IN ('owner', 'admin')
      AND crm.left_at IS NULL
    )
  );

-- 삭제 정책: owner 또는 admin 역할만
CREATE POLICY "pinned_delete_policy" ON chat_pinned_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chat_room_members crm
      WHERE crm.room_id = chat_pinned_messages.room_id
      AND crm.user_id = auth.uid()
      AND crm.role IN ('owner', 'admin')
      AND crm.left_at IS NULL
    )
  );

-- 순서 수정 정책
CREATE POLICY "pinned_update_policy" ON chat_pinned_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chat_room_members crm
      WHERE crm.room_id = chat_pinned_messages.room_id
      AND crm.user_id = auth.uid()
      AND crm.role IN ('owner', 'admin')
      AND crm.left_at IS NULL
    )
  );

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_pinned_room_order
ON chat_pinned_messages(room_id, pin_order);

-- 코멘트
COMMENT ON TABLE chat_pinned_messages IS '채팅방 고정 메시지';
COMMENT ON COLUMN chat_pinned_messages.pin_order IS '고정 순서 (작을수록 상단 표시)';
