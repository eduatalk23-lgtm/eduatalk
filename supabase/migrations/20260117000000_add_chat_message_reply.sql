-- 메시지 답장 기능 추가
-- reply_to_id 컬럼으로 원본 메시지 참조

ALTER TABLE chat_messages
ADD COLUMN reply_to_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL;

-- 인덱스: 답장 메시지 빠른 조회
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to
ON chat_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- 코멘트
COMMENT ON COLUMN chat_messages.reply_to_id IS '답장 대상 메시지 ID (NULL이면 일반 메시지)';
