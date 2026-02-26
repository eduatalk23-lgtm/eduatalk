-- chat_messages.message_type 체크 제약조건 확장
-- 기존: text, system
-- 추가: image, file, mixed (첨부파일 메시지 타입)
ALTER TABLE public.chat_messages
  DROP CONSTRAINT chat_messages_message_type_check;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type = ANY (ARRAY['text', 'system', 'image', 'file', 'mixed']));
