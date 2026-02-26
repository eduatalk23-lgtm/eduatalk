-- chat_attachments.message_id를 nullable로 변경
-- 첨부파일은 메시지 전송 전에 선 업로드되므로,
-- 초기 등록 시 message_id가 NULL이고 메시지 전송 시 연결됨
ALTER TABLE public.chat_attachments
  ALTER COLUMN message_id DROP NOT NULL;

-- 기존 FK 제약조건 삭제 후 재생성 (NULL 허용)
ALTER TABLE public.chat_attachments
  DROP CONSTRAINT chat_attachments_message_id_fkey;

ALTER TABLE public.chat_attachments
  ADD CONSTRAINT chat_attachments_message_id_fkey
  FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE CASCADE;
