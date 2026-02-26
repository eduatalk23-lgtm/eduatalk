-- 1. 고아 첨부파일 조회용 부분 인덱스
--    message_id IS NULL인 행만 인덱싱 (매우 컴팩트)
CREATE INDEX IF NOT EXISTS idx_chat_attachments_orphaned
  ON public.chat_attachments(created_at)
  WHERE message_id IS NULL;

-- 2. 유저별 스토리지 사용량 집계용 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_attachments_sender_file_size
  ON public.chat_attachments(sender_id, file_size);

-- 3. 유저별 스토리지 사용량 RPC 함수
CREATE OR REPLACE FUNCTION public.get_chat_storage_usage(p_sender_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(file_size), 0)::BIGINT
  FROM public.chat_attachments
  WHERE sender_id = p_sender_id;
$$;
