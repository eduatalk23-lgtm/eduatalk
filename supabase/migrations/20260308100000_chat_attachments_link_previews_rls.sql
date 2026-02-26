-- chat_attachments, chat_link_previews 테이블에 RLS 활성화
-- 기존에 누락되어 있던 행 수준 보안 정책을 추가합니다.
-- 멤버십 기반: 해당 방의 멤버만 첨부파일/링크 프리뷰에 접근 가능

-- ============================================
-- chat_attachments RLS
-- ============================================

ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: 해당 방의 멤버만 첨부파일 조회 가능
CREATE POLICY "chat_attachments_member_select"
  ON chat_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_room_members crm
      WHERE crm.room_id = chat_attachments.room_id
        AND crm.user_id = auth.uid()
        AND crm.deleted_at IS NULL
    )
  );

-- INSERT: 본인이 발신자인 경우에만 첨부파일 등록 가능
CREATE POLICY "chat_attachments_sender_insert"
  ON chat_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_room_members crm
      WHERE crm.room_id = chat_attachments.room_id
        AND crm.user_id = auth.uid()
        AND crm.deleted_at IS NULL
    )
  );

-- DELETE: 본인이 올린 첨부파일만 삭제 가능
CREATE POLICY "chat_attachments_sender_delete"
  ON chat_attachments FOR DELETE
  TO authenticated
  USING (
    sender_id = auth.uid()
  );

-- service_role은 RLS를 무시하므로 별도 정책 불필요 (cleanup cron 등)

-- ============================================
-- chat_link_previews RLS
-- ============================================

ALTER TABLE chat_link_previews ENABLE ROW LEVEL SECURITY;

-- SELECT: 해당 메시지의 방 멤버만 링크 프리뷰 조회 가능
CREATE POLICY "chat_link_previews_member_select"
  ON chat_link_previews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_messages cm
      JOIN chat_room_members crm ON crm.room_id = cm.room_id
      WHERE cm.id = chat_link_previews.message_id
        AND crm.user_id = auth.uid()
        AND crm.deleted_at IS NULL
    )
  );

-- INSERT: service_role에서만 삽입 (서버 사이드 fire-and-forget)
-- authenticated 사용자가 직접 삽입할 필요 없음
-- service_role은 RLS bypass하므로 별도 정책 불필요
